// Calendar loading and rendering. Shared projection helpers remain in admin.js.
function setDefaultCalendarRange() {
  adminCalendarStartDate = startOfWeek(new Date());
}

function updateCalendarRangeLabel(gridStart, gridEnd) {
  document.getElementById("calendar_range_label").textContent =
    `${formatDisplayDate(toIsoDate(gridStart))} - ${formatDisplayDate(toIsoDate(gridEnd))}`;
}

function changeAdminCalendarWeeks(offset) {
  if (!adminCalendarStartDate) {
    setDefaultCalendarRange();
  }

  adminCalendarStartDate = addDays(adminCalendarStartDate, offset * 14);
  loadAdminCalendar();
}

function printAdminCalendarView() {
  closeAdminCalendarDayFocus();
  clearAdminPrintModes();
  document.body.classList.add("printing-admin-calendar");
  window.print();
}

async function loadAdminCalendar() {
  const loadSequence = ++adminCalendarLoadSequence;
  if (!adminCalendarStartDate) {
    setDefaultCalendarRange();
  }

  const gridStart = dateOnly(adminCalendarStartDate);
  const gridEnd = addDays(gridStart, 41);
  const from = toIsoDate(addDays(gridStart, -3650));
  const to = toIsoDate(gridEnd);

  updateCalendarRangeLabel(gridStart, gridEnd);
  renderAdminCalendar(gridStart, { status: "Loading calendar..." });

  try {
    const [scheduleRes, orderedRes] = await Promise.all([
      adminFetch(`/schedule?from=${from}&to=${to}`),
      adminFetch("/ordered-items")
    ]);

    if (!scheduleRes.ok) {
      throw new Error(await scheduleRes.text() || "Could not load calendar.");
    }

    const rows = await scheduleRes.json();
    const deliveries = orderedRes.ok ? await orderedRes.json() : [];
    if (loadSequence !== adminCalendarLoadSequence) return;
    adminScheduleRevisions = new Map(rows.map(row => [row.schedule_date, row.revision]));
    adminScheduleRows = new Map(rows.map(row => [row.schedule_date, row.tasks || ""]));
    adminExpectedDeliveriesByDate = buildAdminExpectedDeliveriesByDate(deliveries, gridStart, gridEnd);
    adminActiveScheduleByDate = buildAdminActiveScheduleByDate(rows, gridStart, gridEnd);
    renderAdminCalendar(gridStart);
  } catch (err) {
    if (loadSequence !== adminCalendarLoadSequence) return;
    showMessage("Could not load calendar.", "error");
    renderAdminCalendar(gridStart, { status: "Calendar could not load. Try Refresh or open the tab again." });
    console.error("Admin calendar load failed", err);
  }
}


function renderAdminCalendar(gridStart, options = {}) {
  const calendar = document.getElementById("adminCalendar");
  calendar.innerHTML = "";

  dayNames.forEach(dayName => {
    const header = document.createElement("div");
    header.className = "admin-day-name";
    header.textContent = dayName;
    calendar.appendChild(header);
  });

  if (options.status) {
    const status = document.createElement("div");
    status.className = "calendar-focus-empty admin-calendar-status";
    status.textContent = options.status;
    calendar.appendChild(status);
    return;
  }

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const isoDate = toIsoDate(date);
    const cell = document.createElement("div");
    cell.className = "admin-calendar-day";
    if (date.getDay() === 0 || date.getDay() === 6) {
      cell.classList.add("weekend");
    }
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", `View details for ${formatDisplayDate(isoDate)}`);

    const dateLabel = document.createElement("div");
    dateLabel.className = "admin-calendar-date";
    dateLabel.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
    cell.appendChild(dateLabel);

    const scheduleDay = adminActiveScheduleByDate.get(isoDate) || { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] };
    const activeEvents = scheduleDay.events || [];
    const activeDeliveries = adminExpectedDeliveriesByDate.get(isoDate) || [];

    setupCalendarDropTarget(cell, isoDate);
    appendEventList(cell, activeEvents, true);

    appendBatchList(cell, scheduleDay, isoDate);
    appendTestPickupList(cell, scheduleDay);
    cell.addEventListener("click", event => {
      if (event.target.closest("[draggable=true], button")) return;
      renderAdminFocusedScheduleDay(isoDate, scheduleDay, activeDeliveries);
    });
    cell.addEventListener("keydown", event => {
      if (event.target !== cell) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        renderAdminFocusedScheduleDay(isoDate, scheduleDay, activeDeliveries);
      }
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", event => {
      event.stopPropagation();
      editScheduleDay(isoDate);
    });
    cell.appendChild(editButton);

    calendar.appendChild(cell);
  }
}

let calendarDraggedEvent = null;
let calendarEventMovePending = false;

function setupCalendarEventDrag(item, event) {
  item.draggable = true;
  item.setAttribute("role", "button");
  item.setAttribute("aria-pressed", "false");
  const select = () => {
    document.querySelectorAll(".calendar-card-selected").forEach(card => {
      card.classList.remove("calendar-card-selected");
      card.setAttribute("aria-pressed", "false");
    });
    item.classList.add("calendar-card-selected");
    item.setAttribute("aria-pressed", "true");
  };
  item.addEventListener("click", click => { click.stopPropagation(); select(); });
  item.addEventListener("keydown", key => {
    key.stopPropagation();
    if (key.key === "Enter" || key.key === " ") { key.preventDefault(); select(); }
  });
  item.tabIndex = 0;
  item.title = event.kind === "batch" ? "Select and drag this production batch to another weekday." : "Select and drag this event to another day. The drop date becomes the new start date.";
  item.addEventListener("dragstart", drag => {
    if (calendarEventMovePending || scheduleDaySavePending) { drag.preventDefault(); return; }
    select();
    calendarDraggedEvent = { ...event };
    drag.dataTransfer.effectAllowed = "move";
    drag.dataTransfer.setData("text/plain", event.id || `${event.batchType}:${event.batchIndex}`);
    item.classList.add("calendar-event-dragging");
  });
  item.addEventListener("dragend", () => {
    calendarDraggedEvent = null;
    item.classList.remove("calendar-event-dragging");
    document.querySelectorAll(".calendar-drop-target").forEach(cell => cell.classList.remove("calendar-drop-target"));
  });
}

function setupCalendarDropTarget(cell, date) {
  cell.addEventListener("dragover", event => {
    if (!calendarDraggedEvent || calendarEventMovePending) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    cell.classList.add("calendar-drop-target");
  });
  cell.addEventListener("dragleave", event => {
    if (!cell.contains(event.relatedTarget)) cell.classList.remove("calendar-drop-target");
  });
  cell.addEventListener("drop", event => {
    if (!calendarDraggedEvent || calendarEventMovePending) return;
    event.preventDefault();
    event.stopPropagation();
    cell.classList.remove("calendar-drop-target");
    const moved = calendarDraggedEvent;
    calendarDraggedEvent = null;
    moveAdminCalendarEvent(moved, date);
  });
}

async function moveAdminCalendarEvent(event, targetDate) {
  if (calendarEventMovePending || event.date === targetDate) return;
  // Keep unsaved day edits from being silently discarded by a move.
  const editor = document.getElementById("scheduleEditor");
  if (scheduleDaySavePending || editor.classList.contains("active")) {
    showMessage("Save or cancel the open day editor before moving an event.", "error");
    return;
  }
  calendarEventMovePending = true;
  ++adminCalendarLoadSequence;
  const label = event.kind === "batch" ? "Production batch" : "Event";
  showMessage(`Moving ${label.toLowerCase()}…`);
  try {
    const res = await adminFetch("/admin/calendar/move-event", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDate: event.sourceDate, targetDate, eventId: event.id,
        kind: event.kind, batchType: event.batchType, batchIndex: event.batchIndex, item: event.item,
        sourceRevision: adminScheduleRevisions.get(event.sourceDate) || "missing",
        targetRevision: adminScheduleRevisions.get(targetDate) || "missing" })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    ++adminCalendarLoadSequence;
    data.rows.forEach(row => {
      adminScheduleRows.set(row.schedule_date, row.tasks);
      adminScheduleRevisions.set(row.schedule_date, row.revision);
    });
    const start = dateOnly(adminCalendarStartDate);
    adminActiveScheduleByDate = buildAdminActiveScheduleByDate(
      [...adminScheduleRows].map(([schedule_date, tasks]) => ({ schedule_date, tasks })), start, addDays(start, 41));
    closeAdminCalendarDayFocus();
    renderAdminCalendar(start);
    showMessage(`${label} moved to ${formatDisplayDate(targetDate)}.`, "success");
  } catch (err) {
    showMessage(`Could not confirm the move: ${err.message} Refresh the calendar before retrying.`, "error");
  } finally { calendarEventMovePending = false; }
}
