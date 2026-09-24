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

    appendEventList(cell, activeEvents);

    appendBatchList(cell, scheduleDay);
    appendTestPickupList(cell, scheduleDay);
    cell.addEventListener("click", () => {
      renderAdminFocusedScheduleDay(isoDate, scheduleDay, activeDeliveries);
    });
    cell.addEventListener("keydown", event => {
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

