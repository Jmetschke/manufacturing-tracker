let timerInterval = null;
let startTime = null;
let currentLogId = null;
let loadedItems = [];
let pendingEntry = null;
let savedEntries = [];
let orderedItems = [];
let orderRequests = [];
let pausedSeconds = 0;
let isTimerPaused = false;
let pausedElapsedSeconds = 0;
let calculatorLinkedToQty = false;
const pendingTimerStorageKey = "productionTracker.pendingTimer";
const dailyEntryDefaultsStorageKey = "productionTracker.dailyEntryDefaults";
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function savePendingTimer(state) {
  try {
    localStorage.setItem(pendingTimerStorageKey, JSON.stringify(state));
  } catch (err) {
    console.warn("Could not save pending timer state:", err);
  }
}

function loadPendingTimer() {
  let raw = null;

  try {
    raw = localStorage.getItem(pendingTimerStorageKey);
  } catch (err) {
    console.warn("Could not load pending timer state:", err);
    return null;
  }

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    clearPendingTimer();
    return null;
  }
}

function clearPendingTimer() {
  try {
    localStorage.removeItem(pendingTimerStorageKey);
  } catch (err) {
    console.warn("Could not clear pending timer state:", err);
  }
}

function selectValue(id, value) {
  const element = document.getElementById(id);
  if (value !== undefined && value !== null) {
    element.value = String(value);
  }
}

function getTodayIsoDate() {
  return toIsoDate(new Date());
}

function saveDailyEntryDefaults() {
  const employee = document.getElementById("employee").value;
  const workDate = document.getElementById("work_date").value;

  try {
    localStorage.setItem(dailyEntryDefaultsStorageKey, JSON.stringify({
      savedOn: getTodayIsoDate(),
      employee,
      workDate
    }));
  } catch (err) {
    console.warn("Could not save daily entry defaults:", err);
  }
}

function applyDailyEntryDefaults() {
  let defaults = null;

  try {
    defaults = JSON.parse(localStorage.getItem(dailyEntryDefaultsStorageKey) || "null");
  } catch (err) {
    defaults = null;
  }

  const today = getTodayIsoDate();
  const employee = document.getElementById("employee");
  const workDate = document.getElementById("work_date");

  if (!defaults || defaults.savedOn !== today) {
    workDate.value = today;
    try {
      localStorage.removeItem(dailyEntryDefaultsStorageKey);
    } catch (err) {
      console.warn("Could not clear daily entry defaults:", err);
    }
    return;
  }

  if (defaults.employee) {
    employee.value = defaults.employee;
  }

  workDate.value = defaults.workDate || today;
}

function setupDailyEntryDefaults() {
  ["employee", "work_date"].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.addEventListener("change", saveDailyEntryDefaults);
  });
}

function buildPendingEntry(log) {
  return {
    employee: log.employee,
    workDate: log.work_date,
    item: log.item_id ? log.item : "Item not selected",
    task: log.task_id ? log.task : "Task not selected",
    dispensaryName: log.dispensary_name || "",
    durationSeconds: Number(log.duration_seconds) || 0
  };
}

function getSelectedOptionText(select) {
  if (!select || !select.value) return "";
  const option = select.options[select.selectedIndex];
  return option ? option.text : "";
}

function isDeliveryOrderSelected(select = document.getElementById("item")) {
  return getSelectedOptionText(select).toLowerCase() === "delivery order";
}

function setupDispensaryLocations() {
  const datalist = document.getElementById("dispensaryLocations");
  if (!datalist) return;

  datalist.innerHTML = "";
  (window.dispensaryLocations || []).forEach(location => {
    const option = document.createElement("option");
    option.value = location;
    datalist.appendChild(option);
  });
}

function updateDispensaryField() {
  const field = document.getElementById("dispensaryField");
  const input = document.getElementById("dispensary_name");
  const itemSel = document.getElementById("item");
  if (!field || !input || !itemSel) return;

  const isDeliveryOrder = isDeliveryOrderSelected(itemSel);
  field.classList.toggle("active", isDeliveryOrder);
  input.disabled = !isDeliveryOrder;
  if (!isDeliveryOrder) input.value = "";
}

function syncPendingWorkSelection() {
  if (!pendingEntry) return;

  const itemText = getSelectedOptionText(document.getElementById("item"));
  const taskText = getSelectedOptionText(document.getElementById("task"));

  pendingEntry.item = itemText || "Item not selected";
  pendingEntry.task = taskText || "Task not selected";
  pendingEntry.dispensaryName = document.getElementById("dispensary_name").value.trim();
  updateTimerWorkflowUI();
}

function updatePauseButton() {
  const pauseBtn = document.getElementById("pauseBtn");
  if (!pauseBtn) return;

  pauseBtn.textContent = isTimerPaused ? "Resume" : "Pause";
  pauseBtn.disabled = !currentLogId || (!startTime && !isTimerPaused);
}

function setTimerMessage(text, type = "") {
  const message = document.getElementById("timerMessage");
  if (!message) return;

  message.textContent = text;
  message.className = type ? `timer-message ${type}` : "timer-message";
}

function updateTimerWorkflowUI() {
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stopBtn = document.getElementById("stopBtn");
  const saveBtn = document.getElementById("saveBtn");
  const readyActions = document.getElementById("readyActions");
  const activeActions = document.getElementById("activeActions");
  const finishEntryPanel = document.getElementById("finishEntryPanel");
  const qtyInput = document.getElementById("qty");
  const status = document.getElementById("timerStatus");
  const hint = document.getElementById("timerHint");
  const context = document.getElementById("timerContext");
  const timerStep = document.getElementById("timerStep");
  const finishDuration = document.getElementById("finishDuration");

  if (
    !startBtn ||
    !pauseBtn ||
    !stopBtn ||
    !saveBtn ||
    !readyActions ||
    !activeActions ||
    !finishEntryPanel ||
    !qtyInput ||
    !status ||
    !hint ||
    !context ||
    !timerStep ||
    !finishDuration
  ) {
    updatePauseButton();
    return;
  }

  const hasActiveLog = Boolean(currentLogId);
  const stoppedNeedsQty = hasActiveLog && !startTime && !isTimerPaused;
  const running = hasActiveLog && Boolean(startTime) && !isTimerPaused;
  const paused = hasActiveLog && isTimerPaused;

  startBtn.disabled = hasActiveLog;
  pauseBtn.disabled = !running && !paused;
  stopBtn.disabled = !running && !paused;
  saveBtn.disabled = !stoppedNeedsQty;
  qtyInput.disabled = !stoppedNeedsQty;
  readyActions.style.display = hasActiveLog ? "none" : "flex";
  activeActions.style.display = running || paused ? "flex" : "none";
  finishEntryPanel.classList.toggle("active", stoppedNeedsQty);
  finishDuration.textContent = pendingEntry
    ? formatSeconds(pendingEntry.durationSeconds || pausedElapsedSeconds || 0)
    : document.getElementById("timer").innerText;

  ["employee", "work_date"].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.disabled = hasActiveLog;
  });
  updateDispensaryField();

  if (pendingEntry) {
    const dispensaryText = pendingEntry.dispensaryName
      ? ` | ${pendingEntry.dispensaryName}`
      : "";
    context.textContent = `${pendingEntry.employee} | ${pendingEntry.item} | ${pendingEntry.task}${dispensaryText}`;
    context.classList.add("active");
  } else {
    context.textContent = "";
    context.classList.remove("active");
  }

  status.className = "timer-status";
  if (running) {
    timerStep.textContent = "Step 2 of 3";
    status.classList.add("running");
    status.textContent = "Timer running";
    hint.textContent = "Work is being timed. Select item and task any time before saving.";
  } else if (paused) {
    timerStep.textContent = "Step 2 of 3";
    status.classList.add("paused");
    status.textContent = "Timer paused";
    hint.textContent = "Tap Resume to continue, or select item and task before saving.";
  } else if (stoppedNeedsQty) {
    timerStep.textContent = "Step 3 of 3";
    status.classList.add("stopped");
    status.textContent = "Timer stopped";
    hint.textContent = "Select item, task, and completed quantity, then save the entry.";
  } else {
    timerStep.textContent = "Step 1 of 3";
    status.classList.add("ready");
    status.textContent = "Ready to start";
    hint.textContent = "Choose employee/date, then start the timer. Item and task can be selected before saving.";
  }

  updatePauseButton();
}

function applyTimerState(log) {
  pausedSeconds = Number(log.paused_seconds) || 0;
  isTimerPaused = Boolean(log.pause_started_at);
  pausedElapsedSeconds = Math.max(0, Number(log.elapsed_seconds) || 0);

  if (isTimerPaused) {
    startTime = Number(log.start_epoch) * 1000;
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById("timer").innerText = formatSeconds(pausedElapsedSeconds);
    updateTimerWorkflowUI();
    return;
  }

  startTime = Number(log.start_epoch) * 1000;
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  updateTimerWorkflowUI();
}

function loadEmployeeOptions() {
  const employeeSel = document.getElementById("employee");

  window.employeeNames.forEach(employee => {
    const option = document.createElement("option");
    option.value = employee;
    option.text = employee;
    employeeSel.appendChild(option);
  });
}

function formatSeconds(sec) {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  return (
    String(hours).padStart(2, "0") + ":" +
    String(minutes).padStart(2, "0") + ":" +
    String(seconds).padStart(2, "0")
  );
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function getProjectedWorkDates(startDate, days) {
  const dates = [];
  let current = dateOnly(startDate);

  while (dates.length < days) {
    if (!isWeekend(current)) {
      dates.push(current);
    }

    current = addDays(current, 1);
  }

  return dates;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const start = dateOnly(date);
  return addDays(start, -start.getDay());
}

function formatDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function normalizeBatchList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === "object") {
          return {
            item: String(item.item || "").trim(),
            units: String(item.units || "").trim()
          };
        }

        return {
          item: String(item || "").trim(),
          units: ""
        };
      })
      .filter(batch => batch.item);
  }

  const singleValue = String(value || "").trim();
  return singleValue ? [{ item: singleValue, units: "" }] : [];
}

function isHHMM(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function hasValidOptionalEventTimes(event) {
  return event.times.every(time => {
    const hasStart = Boolean(time.start);
    const hasEnd = Boolean(time.end);
    return (!hasStart && !hasEnd) || (isHHMM(time.start) && isHHMM(time.end));
  });
}

function normalizeEventList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(event => {
      const days = Math.max(1, Number.parseInt(event && event.days, 10) || 1);
      const times = Array.isArray(event && event.times) ? event.times : [];

      return {
        date: String(event && event.date ? event.date : "").trim(),
        title: String(event && event.title ? event.title : "").trim(),
        days,
        times: Array.from({ length: days }, (_, index) => ({
          start: String(times[index] && times[index].start ? times[index].start : "").trim(),
          end: String(times[index] && times[index].end ? times[index].end : "").trim()
        })),
        location: String(event && event.location ? event.location : "").trim(),
        company: String(event && event.company ? event.company : "").trim()
      };
    })
    .filter(event =>
      /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
      event.title &&
      event.location &&
      event.company &&
      hasValidOptionalEventTimes(event)
    );
}

function parseSchedulePayload(rawValue) {
  const empty = {
    batchHijnx: [],
    batchSb: [],
    events: [],
    tasks: [],
    testPickups: []
  };

  if (!rawValue) return empty;

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      return {
        batchHijnx: normalizeBatchList(parsed.batchHijnx),
        batchSb: normalizeBatchList(parsed.batchSb),
        events: normalizeEventList(parsed.events),
        tasks: Array.isArray(parsed.tasks)
          ? parsed.tasks
              .map(normalizeScheduleTask)
              .filter(task => task.text)
          : [],
        testPickups: normalizeTestPickups(parsed.testPickups)
      };
    }

    if (Array.isArray(parsed)) {
      return {
        ...empty,
        tasks: parsed
          .map(normalizeScheduleTask)
          .filter(task => task.text),
        testPickups: []
      };
    }
  } catch (err) {
    // Older saved calendar entries are plain newline-delimited text.
  }

  return {
    ...empty,
    tasks: String(rawValue)
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => ({ text: line, days: 1, totalHours: 0, assignments: [] })),
    testPickups: []
  };
}

function normalizeTestPickups(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(pickup => ({
      time: String(pickup && pickup.time ? pickup.time : "").trim(),
      items: Array.isArray(pickup && pickup.items)
        ? pickup.items.map(item => String(item || "").trim()).filter(Boolean)
        : []
    }))
    .filter(pickup => /^([01]\d|2[0-3]):[0-5]\d$/.test(pickup.time) && pickup.items.length);
}

function normalizeScheduleAssignments(value, days) {
  if (!Array.isArray(value)) return [];

  return value
    .map(assignment => ({
      dayIndex: Math.max(0, Number.parseInt(assignment && assignment.dayIndex, 10) || 0),
      employee: String(assignment && assignment.employee ? assignment.employee : "").trim(),
      hours: Math.max(0, Number.parseFloat(assignment && assignment.hours) || 0)
    }))
    .filter(assignment => assignment.dayIndex < days && assignment.employee && assignment.hours > 0);
}

function normalizeScheduleTask(task) {
  const text = String(task && task.text ? task.text : "").trim();
  const days = Math.max(1, Number.parseInt(task && task.days, 10) || 1);
  const totalHours = Math.max(0, Number.parseFloat(task && task.totalHours) || 0);

  return {
    text,
    days,
    totalHours,
    assignments: normalizeScheduleAssignments(task && task.assignments, days)
  };
}

function formatTaskHours(value) {
  const hours = Number.parseFloat(value);
  if (!Number.isFinite(hours)) return "0 hrs";
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })} hr${rounded === 1 ? "" : "s"}`;
}

function appendTaskList(container, tasks) {
  if (!tasks.length) return;

  const list = document.createElement("ol");
  list.className = "schedule-task-list";

  tasks.forEach(task => {
    const item = document.createElement("li");
    const parts = [task.text];
    if (task.employee && task.hours) {
      parts.push(`${task.employee}: ${formatTaskHours(task.hours)}`);
    } else if (task.totalHours) {
      parts.push(`${formatTaskHours(task.remainingHours)} remaining`);
    } else if (task.days > 1) {
      parts.push(`${task.days} days`);
    }
    if (task.employee && Number.isFinite(task.remainingHours)) {
      parts.push(`${formatTaskHours(task.remainingHours)} left`);
    }
    item.textContent = parts.join(" - ");
    list.appendChild(item);
  });

  container.appendChild(list);
}

function groupDailyTaskAssignments(tasks) {
  const groups = new Map();

  tasks.forEach(task => {
    if (!groups.has(task.text)) {
      groups.set(task.text, {
        text: task.text,
        assignedHours: 0,
        remainingHours: task.remainingHours,
        people: new Map(),
        legacyDays: task.days || 1
      });
    }

    const group = groups.get(task.text);
    if (task.hours) {
      group.assignedHours += task.hours;
    }
    if (Number.isFinite(task.remainingHours)) {
      group.remainingHours = task.remainingHours;
    }
    if (task.employee && task.hours) {
      group.people.set(task.employee, (group.people.get(task.employee) || 0) + task.hours);
    }
  });

  return Array.from(groups.values());
}

function appendCalendarTaskSummary(container, tasks) {
  if (!tasks.length) return;

  const list = document.createElement("ol");
  list.className = "schedule-task-list";

  groupDailyTaskAssignments(tasks).forEach(task => {
    const item = document.createElement("li");
    item.textContent = task.assignedHours > 0
      ? `${task.text} - ${formatTaskHours(task.assignedHours)}`
      : task.legacyDays > 1
        ? `${task.text} - ${task.legacyDays} days`
        : task.text;
    list.appendChild(item);
  });

  container.appendChild(list);
}

function createFocusEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "calendar-focus-empty";
  empty.textContent = text;
  return empty;
}

function appendFocusLines(container, lines, formatLine, emptyText) {
  if (!lines.length) {
    container.appendChild(createFocusEmpty(emptyText));
    return;
  }

  lines.forEach(line => {
    const item = document.createElement("div");
    item.className = "calendar-focus-item";
    item.textContent = formatLine(line);
    container.appendChild(item);
  });
}

function renderFocusedScheduleDay(isoDate, scheduleDay, deliveries) {
  const panel = document.getElementById("scheduleDayFocus");
  const title = document.getElementById("scheduleDayFocusTitle");
  const body = document.getElementById("scheduleDayFocusBody");
  if (!panel || !title || !body) return;

  title.textContent = formatDisplayDate(isoDate);
  body.innerHTML = "";

  const section = (headingText, fill) => {
    const block = document.createElement("div");
    block.className = "calendar-focus-section";
    const heading = document.createElement("h4");
    heading.textContent = headingText;
    block.appendChild(heading);
    fill(block);
    body.appendChild(block);
  };

  section("Tasks", block => {
    const groups = groupDailyTaskAssignments(scheduleDay.tasks || []);
    if (!groups.length) {
      block.appendChild(createFocusEmpty("No tasks scheduled."));
      return;
    }

    groups.forEach(task => {
      const item = document.createElement("div");
      item.className = "calendar-focus-item";
      const titleLine = document.createElement("b");
      titleLine.textContent = `${task.text} - ${formatTaskHours(task.assignedHours)} assigned`;
      item.appendChild(titleLine);

      if (task.people.size) {
        const people = document.createElement("div");
        people.textContent = `${task.people.size} person${task.people.size === 1 ? "" : "s"} assigned`;
        item.appendChild(people);

        const list = document.createElement("ul");
        task.people.forEach((hours, employee) => {
          const person = document.createElement("li");
          person.textContent = `${employee}: ${formatTaskHours(hours)}`;
          list.appendChild(person);
        });
        item.appendChild(list);
      } else {
        item.appendChild(createFocusEmpty("No person hours assigned for this day."));
      }

      if (Number.isFinite(task.remainingHours)) {
        const remaining = document.createElement("div");
        remaining.textContent = `${formatTaskHours(task.remainingHours)} remaining after this day`;
        item.appendChild(remaining);
      }

      block.appendChild(item);
    });
  });

  section("Events", block => appendFocusLines(block, scheduleDay.events || [], event => {
    const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
    return `${event.title}${timeText} - ${event.location} - ${event.company}`;
  }, "No events scheduled."));

  section("Production Batches", block => appendFocusLines(block, [
    ...(scheduleDay.batchHijnx || []).map(batch => ({ label: "Hijnx", ...batch })),
    ...(scheduleDay.batchSb || []).map(batch => ({ label: "SB", ...batch }))
  ], batch => batch.units ? `${batch.label}: ${batch.item} - ${batch.units} units` : `${batch.label}: ${batch.item}`, "No production batches."));

  section("Deliveries", block => appendFocusLines(block, deliveries, delivery =>
    `${delivery.calendar_delivery_status}: ${delivery.item_name} - QTY ${delivery.package_qty || ""}`.trim(),
  "No deliveries."));

  section("Test Pick Ups", block => appendFocusLines(block, scheduleDay.testPickups || [], pickup =>
    `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`,
  "No test pick ups."));

  panel.hidden = false;
  panel.scrollIntoView({ block: "start", behavior: "smooth" });
}

function appendTestPickupList(container, testPickups) {
  if (!testPickups.length) return;

  const pickupList = document.createElement("div");
  pickupList.className = "test-pickup-list";

  testPickups.forEach(pickup => {
    const item = document.createElement("div");
    item.className = "test-pickup";
    item.textContent = `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`;
    pickupList.appendChild(item);
  });

  container.appendChild(pickupList);
}

function appendEventList(container, events) {
  if (!events.length) return;

  const eventList = document.createElement("div");
  eventList.className = "event-list";

  events.forEach(event => {
    const item = document.createElement("div");
    item.className = "event-item";
    const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
    item.textContent = `${event.title}${timeText} - ${event.location} - ${event.company}`;
    eventList.appendChild(item);
  });

  container.appendChild(eventList);
}

function appendBatchList(container, scheduleDay) {
  const batches = [
    ...scheduleDay.batchHijnx.map(batch => ["Production Batch - Hijnx", batch]),
    ...scheduleDay.batchSb.map(batch => ["Production Batch - SB", batch])
  ];

  if (!batches.length) return;

  const batchList = document.createElement("div");
  batchList.className = "schedule-batches";

  batches.forEach(([label, batch]) => {
    const item = document.createElement("div");
    item.className = "schedule-batch";
    item.textContent = batch.units
      ? `${label}: ${batch.item} - ${batch.units} units`
      : `${label}: ${batch.item}`;
    batchList.appendChild(item);
  });

  container.appendChild(batchList);
}

function buildExpectedDeliveriesByDate(items, visibleStart, visibleEnd) {
  const deliveriesByDate = new Map();
  const rangeStartIso = toIsoDate(visibleStart);
  const rangeEndIso = toIsoDate(visibleEnd);

  items.forEach(item => {
    const isReceived = Boolean(item.received_date);
    const deliveryDate = isReceived ? item.received_date : item.expected_delivery_date;
    if (!deliveryDate || Number(item.import_needs_delivery_date)) return;
    if (deliveryDate < rangeStartIso || deliveryDate > rangeEndIso) return;

    if (!deliveriesByDate.has(deliveryDate)) {
      deliveriesByDate.set(deliveryDate, []);
    }

    deliveriesByDate.get(deliveryDate).push({
      ...item,
      calendar_delivery_status: isReceived ? "Delivered" : "Expected"
    });
  });

  return deliveriesByDate;
}

function appendExpectedDeliveries(container, deliveries) {
  if (!deliveries.length) return;

  const section = document.createElement("div");
  section.className = "calendar-deliveries";

  const groups = [
    ["Expected", deliveries.filter(delivery => delivery.calendar_delivery_status !== "Delivered")],
    ["Delivered", deliveries.filter(delivery => delivery.calendar_delivery_status === "Delivered")]
  ];

  groups.forEach(([label, group]) => {
    if (!group.length) return;

    const heading = document.createElement("div");
    heading.className = "calendar-delivery-heading";
    heading.textContent = `${label} Deliveries`;
    section.appendChild(heading);

    group.forEach(delivery => {
      const item = document.createElement("div");
      item.className = "calendar-delivery";
      item.textContent = `${delivery.item_name} - QTY ${delivery.package_qty}`;
      section.appendChild(item);
    });
  });

  container.appendChild(section);
}

function buildActiveScheduleByDate(rows, visibleStart, visibleEnd) {
  const activeSchedule = new Map();
  const rangeStart = dateOnly(visibleStart);
  const rangeEnd = dateOnly(visibleEnd);

  for (let index = 0; index <= 13; index += 1) {
    activeSchedule.set(toIsoDate(addDays(rangeStart, index)), {
      batchHijnx: [],
      batchSb: [],
      events: [],
      tasks: [],
      testPickups: []
    });
  }

  rows.forEach(row => {
    const [year, month, day] = row.schedule_date.split("-").map(Number);
    const startDate = new Date(year, month - 1, day);
    const payload = parseSchedulePayload(row.tasks);

    if (activeSchedule.has(row.schedule_date)) {
      const scheduleDay = activeSchedule.get(row.schedule_date);
      scheduleDay.batchHijnx = payload.batchHijnx;
      scheduleDay.batchSb = payload.batchSb;
      scheduleDay.testPickups = payload.testPickups;
    }

    payload.events.forEach(event => {
      const [eventYear, eventMonth, eventDay] = event.date.split("-").map(Number);
      const eventStart = new Date(eventYear, eventMonth - 1, eventDay);

      for (let index = 0; index < event.days; index += 1) {
        const eventDate = addDays(eventStart, index);
        if (eventDate < rangeStart || eventDate > rangeEnd) continue;

        const isoDate = toIsoDate(eventDate);
        if (!activeSchedule.has(isoDate)) {
          activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [] });
        }

        const time = event.times[index] || { start: "", end: "" };
        activeSchedule.get(isoDate).events.push({
          title: event.title,
          start: time.start,
          end: time.end,
          location: event.location,
          company: event.company
        });
      }
    });

    payload.tasks.forEach(task => {
      let remainingHours = task.totalHours;
      const workDates = getProjectedWorkDates(startDate, task.days);

      workDates.forEach((activeDate, dayIndex) => {
        const dayAssignments = (task.assignments || [])
          .filter(assignment => assignment.dayIndex === dayIndex);
        const projectedTasks = [];

        if (task.totalHours > 0 && dayAssignments.length) {
          dayAssignments.forEach(assignment => {
            const appliedHours = Math.min(remainingHours, assignment.hours);
            remainingHours = Math.max(0, remainingHours - assignment.hours);
            if (appliedHours <= 0) return;

            projectedTasks.push({
              text: task.text,
              employee: assignment.employee,
              hours: appliedHours,
              remainingHours,
              totalHours: task.totalHours
            });
          });
        } else if (task.totalHours > 0) {
          projectedTasks.push({
            text: task.text,
            remainingHours,
            totalHours: task.totalHours
          });
        } else {
          projectedTasks.push({ text: task.text, days: task.days });
        }

        if (activeDate < rangeStart || activeDate > rangeEnd) return;

        const isoDate = toIsoDate(activeDate);
        if (!activeSchedule.has(isoDate)) {
          activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [] });
        }
        activeSchedule.get(isoDate).tasks.push(...projectedTasks);
      });
    });
  });

  return activeSchedule;
}

function renderSavedEntries() {
  const container = document.getElementById("savedEntries");
  container.innerHTML = "";

  if (!savedEntries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-entries";
    empty.textContent = "No entries saved yet.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const labels = ["Date", "Employee", "Item", "Dispensary", "Task", "Qty", "Time"];
  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  savedEntries.forEach(entry => {
    const row = document.createElement("tr");
    [
      entry.workDate,
      entry.employee,
      entry.item,
      entry.dispensaryName || "",
      entry.task,
      entry.quantity,
      formatSeconds(entry.durationSeconds)
    ].forEach((value, index) => {
      const td = document.createElement("td");
      td.dataset.label = labels[index];
      td.textContent = value;
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

const bulkTypes = [
  { label: "Speed Rack(1pks)", value: 2400 },
  { label: "Speed Rack(2pks)", value: 1200 },
  { label: "Speed Rack(10pks)", value: 1000 },
  { label: "Speed Rack(3pks)", value: 3360 },
  { label: "Sheet Pan(1pks)", value: 120 },
  { label: "Sheetpan(2pks)", value: 60 },
  { label: "Sheetpan(10pk)", value: 50 },
  { label: "Sheetpan(3pk)", value: 168 },
  { label: "Mold(10g 1pk)", value: 40 },
  { label: "Mold(10g 2pk)", value: 20 },
  { label: "Mold(2.4g 10pk)", value: 12.6 },
  { label: "Mold (2.4g 3pk)", value: 42 },
  { label: "Band og Bags(100)", value: 100 },
  { label: "Band of Bags(50)", value: 50 },
  { label: "Bulk Units(1unit)", value: 1 }
];

async function load() {
  loadEmployeeOptions();

  const items = await fetch("/items").then(r => r.json());
  const tasks = await fetch("/tasks").then(r => r.json());
  loadedItems = items;

  const itemSel = document.getElementById("item");
  const taskSel = document.getElementById("task");

  itemSel.innerHTML = "";
  taskSel.innerHTML = "";

  const itemPlaceholder = document.createElement("option");
  itemPlaceholder.value = "";
  itemPlaceholder.text = "Select Item";
  itemSel.appendChild(itemPlaceholder);

  const taskPlaceholder = document.createElement("option");
  taskPlaceholder.value = "";
  taskPlaceholder.text = "Select Task";
  taskSel.appendChild(taskPlaceholder);

  items.forEach(i => {
    const o = document.createElement("option");
    o.value = i.id;
    o.text = i.name;
    itemSel.appendChild(o);
  });

  tasks.forEach(t => {
    const o = document.createElement("option");
    o.value = t.id;
    o.text = t.name;
    taskSel.appendChild(o);
  });

  setupDispensaryLocations();
  updateDispensaryField();

  itemSel.addEventListener("change", () => {
    updateDispensaryField();
    syncPendingWorkSelection();
  });
  taskSel.addEventListener("change", syncPendingWorkSelection);
  document.getElementById("dispensary_name").addEventListener("input", syncPendingWorkSelection);

  setupDailyEntryDefaults();
  applyDailyEntryDefaults();
  document.getElementById("qty").disabled = true;
  document.getElementById("pauseBtn").disabled = true;
  document.getElementById("stopBtn").disabled = true;
  document.getElementById("saveBtn").disabled = true;

  renderSavedEntries();
  resetOrderRequestForm();
  resetManualReceivedForm();
  setupTimeInput("manual_received_time");
  addCalcRow();
  await restorePendingTimer();
  updateTimerWorkflowUI();
}

function showTab(tabName) {
  const trackerTab = document.getElementById("trackerTab");
  const calculatorTab = document.getElementById("calculatorTab");
  const scheduleTab = document.getElementById("scheduleTab");
  const orderedTab = document.getElementById("orderedTab");
  const buttons = document.querySelectorAll(".tab-button");

  trackerTab.classList.toggle("active", tabName === "tracker");
  calculatorTab.classList.toggle("active", tabName === "calculator");
  scheduleTab.classList.toggle("active", tabName === "schedule");
  orderedTab.classList.toggle("active", tabName === "ordered");

  buttons.forEach(button => {
    const isActive =
      (tabName === "tracker" && button.textContent === "Time Entry") ||
      (tabName === "calculator" && button.textContent === "Qty Calculator") ||
      (tabName === "schedule" && button.textContent === "Schedule") ||
      (tabName === "ordered" && button.textContent === "Ordered Items");

    button.classList.toggle("active", isActive);
  });

  if (tabName === "schedule") {
    loadSchedule();
  }

  if (tabName === "ordered") {
    loadOrderedTab();
  }
}

function createBulkTypeSelect() {
  const select = document.createElement("select");
  select.className = "calc-bulk-type";

  bulkTypes.forEach(type => {
    const option = document.createElement("option");
    option.value = type.label;
    option.dataset.bulkValue = String(type.value);
    option.text = type.label;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    calculatorLinkedToQty = true;
    updateCalculator();
  });
  return select;
}

function addCalcRow() {
  const rows = document.getElementById("calcRows");
  const tr = document.createElement("tr");

  const bulkTypeCell = document.createElement("td");
  bulkTypeCell.dataset.label = "Bulk Type";
  bulkTypeCell.appendChild(createBulkTypeSelect());

  const bulkCountCell = document.createElement("td");
  bulkCountCell.dataset.label = "# of Bulk Type";
  bulkCountCell.appendChild(createCalcInput("calc-bulk-count"));

  const totalCell = document.createElement("td");
  totalCell.dataset.label = "Calculated Qty";
  const totalInput = document.createElement("input");
  totalInput.type = "number";
  totalInput.className = "calc-row-total";
  totalInput.value = "0";
  totalInput.readOnly = true;
  totalCell.appendChild(totalInput);

  const removeCell = document.createElement("td");
  removeCell.dataset.label = "Action";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    tr.remove();
    updateCalculator();
  });
  removeCell.appendChild(removeButton);

  tr.appendChild(bulkTypeCell);
  tr.appendChild(bulkCountCell);
  tr.appendChild(totalCell);
  tr.appendChild(removeCell);
  rows.appendChild(tr);

  updateCalculator();
}

function createCalcInput(className) {
  const input = document.createElement("input");
  input.type = "number";
  input.setAttribute("list", "bulkCountOptions");
  input.min = "0";
  input.step = "1";
  input.value = "0";
  input.className = className;
  input.addEventListener("input", () => {
    calculatorLinkedToQty = true;
    updateCalculator();
  });
  return input;
}

function getNumberFromRow(row, selector) {
  const value = Number(row.querySelector(selector).value);
  return Number.isFinite(value) ? value : 0;
}

function updateCalculator() {
  const rows = document.querySelectorAll("#calcRows tr");
  let grandTotal = 0;

  rows.forEach(row => {
    const bulkTypeSelect = row.querySelector(".calc-bulk-type");
    const selectedOption = bulkTypeSelect.options[bulkTypeSelect.selectedIndex];
    const bulkValue = Number(selectedOption.dataset.bulkValue);
    const bulkCount = getNumberFromRow(row, ".calc-bulk-count");
    const rowTotal = bulkValue * bulkCount;

    row.querySelector(".calc-row-total").value = String(rowTotal);
    grandTotal += rowTotal;
  });

  document.getElementById("calcGrandTotal").textContent = String(grandTotal);

  if (calculatorLinkedToQty) {
    syncCalculatorTotalToQty(grandTotal);
  }
}

function clearCalculator() {
  document.getElementById("calcRows").innerHTML = "";
  addCalcRow();
}

function copyCalcTotalToQty() {
  const total = document.getElementById("calcGrandTotal").textContent;

  calculatorLinkedToQty = true;
  syncCalculatorTotalToQty(total);
  showTab("tracker");

  const qtyInput = document.getElementById("qty");
  if (!qtyInput.disabled) {
    qtyInput.focus();
  }
}

function syncCalculatorTotalToQty(total) {
  const qtyInput = document.getElementById("qty");
  if (!qtyInput) return;

  qtyInput.value = String(total);
}

async function startTimer() {
  if (currentLogId) {
    setTimerMessage("A timer is already active. Stop it before starting a new one.", "error");
    return;
  }

  const employee = document.getElementById("employee").value;
  const work_date = document.getElementById("work_date").value;
  const itemSel = document.getElementById("item");
  const taskSel = document.getElementById("task");
  const dispensaryName = isDeliveryOrderSelected(itemSel)
    ? document.getElementById("dispensary_name").value.trim()
    : "";

  if (!employee || !work_date) {
    setTimerMessage("Select an employee and date before starting.", "error");
    return;
  }

  const res = await fetch("/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: itemSel.value || null,
      task_id: taskSel.value || null,
      dispensary_name: dispensaryName,
      employee,
      work_date
    })
  });

  if (!res.ok) {
    const text = await res.text();
    setTimerMessage("Start failed: " + text, "error");
    return;
  }

  const data = await res.json();
  currentLogId = data.log_id;

  startTime = Number(data.start_epoch) * 1000;
  pausedSeconds = 0;
  isTimerPaused = false;
  pausedElapsedSeconds = 0;
  pendingEntry = {
    employee,
    workDate: work_date,
    item: getSelectedOptionText(itemSel) || "Item not selected",
    task: getSelectedOptionText(taskSel) || "Task not selected",
    dispensaryName,
    durationSeconds: 0
  };
  savePendingTimer({ logId: currentLogId });

  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  setTimerMessage("Timer started.");
  updateTimerWorkflowUI();
}

async function stopTimer() {
  if (!currentLogId) {
    setTimerMessage("Start a timer before stopping.", "error");
    return;
  }

  const res = await fetch("/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log_id: currentLogId })
  });

  if (!res.ok) {
    const text = await res.text();
    setTimerMessage("Stop failed: " + text, "error");
    return;
  }

  clearInterval(timerInterval);
  timerInterval = null;
  const data = await res.json();
  if (pendingEntry) {
    pendingEntry.durationSeconds = Number(data.duration_seconds) || 0;
  }
  startTime = null;
  pausedSeconds = 0;
  isTimerPaused = false;
  pausedElapsedSeconds = 0;
  savePendingTimer({ logId: currentLogId });

  const qtyInput = document.getElementById("qty");
  const saveBtn = document.getElementById("saveBtn");

  qtyInput.disabled = false;
  saveBtn.disabled = false;
  qtyInput.focus();
  setTimerMessage("Timer stopped. Enter quantity, then save the entry.");
  updateTimerWorkflowUI();
}

async function pauseTimer() {
  if (!currentLogId || (!startTime && !isTimerPaused)) {
    setTimerMessage("Start a timer before pausing.", "error");
    return;
  }

  const endpoint = isTimerPaused ? "/resume" : "/pause";
  let res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log_id: currentLogId })
  });

  if (!res.ok && isTimerPaused) {
    res = await fetch("/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_id: currentLogId })
    });
  }

  if (!res.ok) {
    const text = await res.text();
    setTimerMessage((isTimerPaused ? "Resume" : "Pause") + " failed: " + text, "error");
    return;
  }

  const data = await res.json();
  const wasPaused = isTimerPaused;
  applyTimerState(data);
  savePendingTimer({ logId: currentLogId });
  setTimerMessage(wasPaused ? "Timer resumed." : "Timer paused.");
}

async function saveQuantity() {
  const qtyInput = document.getElementById("qty");
  const saveBtn = document.getElementById("saveBtn");
  const quantity = qtyInput.value;
  const itemSel = document.getElementById("item");
  const taskSel = document.getElementById("task");
  const item_id = itemSel.value;
  const task_id = taskSel.value;
  const dispensaryName = isDeliveryOrderSelected(itemSel)
    ? document.getElementById("dispensary_name").value.trim()
    : "";

  if (!currentLogId) {
    setTimerMessage("No stopped timer is waiting for quantity.", "error");
    return;
  }

  if (!item_id || !task_id) {
    setTimerMessage("Select item and task before saving the entry.", "error");
    return;
  }

  if (!quantity) {
    setTimerMessage("Enter quantity before finishing the entry.", "error");
    return;
  }

  const res = await fetch("/update-qty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      log_id: currentLogId,
      item_id,
      task_id,
      dispensary_name: dispensaryName,
      quantity
    })
  });

  if (!res.ok) {
    const text = await res.text();
    setTimerMessage("Save failed: " + text, "error");
    return;
  }

  savedEntries.unshift({
    ...pendingEntry,
    item: getSelectedOptionText(itemSel),
    task: getSelectedOptionText(taskSel),
    dispensaryName,
    quantity
  });
  renderSavedEntries();

  currentLogId = null;
  pendingEntry = null;
  startTime = null;
  pausedSeconds = 0;
  isTimerPaused = false;
  pausedElapsedSeconds = 0;
  clearPendingTimer();
  qtyInput.value = "";
  document.getElementById("dispensary_name").value = "";
  qtyInput.disabled = true;
  saveBtn.disabled = true;
  document.getElementById("timer").innerText = "00:00:00";
  setTimerMessage("Entry completed and saved.");
  updateTimerWorkflowUI();
}

function updateTimer() {
  if (!startTime || isTimerPaused) return;

  const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000) - pausedSeconds);

  document.getElementById("timer").innerText = formatSeconds(elapsed);
}

function restoreTimerFromLog(log) {
  if (log.quantity !== null && log.quantity !== undefined) {
    clearPendingTimer();
    return false;
  }

  currentLogId = log.log_id;
  pendingEntry = buildPendingEntry(log);

  selectValue("employee", log.employee);
  selectValue("work_date", log.work_date);
  selectValue("item", log.item_id);
  selectValue("task", log.task_id);
  selectValue("dispensary_name", log.dispensary_name);
  updateDispensaryField();

  if (log.end_time) {
    startTime = null;
    pausedSeconds = 0;
    isTimerPaused = false;
    pausedElapsedSeconds = 0;
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById("timer").innerText = formatSeconds(pendingEntry.durationSeconds);
    document.getElementById("qty").disabled = false;
    document.getElementById("saveBtn").disabled = false;
    updateTimerWorkflowUI();
    return true;
  }

  applyTimerState(log);
  return true;
}

async function fetchRecoverableTimer() {
  const employee = document.getElementById("employee").value;
  const workDate = document.getElementById("work_date").value;

  if (!employee || !workDate) return null;

  const params = new URLSearchParams({ employee, work_date: workDate });
  const res = await fetch(`/active-timer?${params.toString()}`);

  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) return null;

  return res.json();
}

async function restorePendingTimer() {
  const storedTimer = loadPendingTimer();

  if (storedTimer && storedTimer.logId) {
    const res = await fetch(`/timer-state/${storedTimer.logId}`);
    if (res.status === 404) {
      clearPendingTimer();
    } else if (res.ok) {
      const log = await res.json();
      if (restoreTimerFromLog(log)) return;
    }
  }

  const recoverableLog = await fetchRecoverableTimer();
  if (!recoverableLog) return;

  if (restoreTimerFromLog(recoverableLog)) {
    savePendingTimer({ logId: recoverableLog.log_id });
    setTimerMessage("Recovered an unfinished timer from the database.");
  }
}

async function loadSchedule() {
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 13);
  const from = toIsoDate(addDays(weekStart, -180));
  const to = toIsoDate(weekEnd);
  const [scheduleRes, orderedRes] = await Promise.all([
    fetch(`/schedule?from=${from}&to=${to}`),
    fetch("/ordered-items")
  ]);

  if (!scheduleRes.ok) return;

  const rows = await scheduleRes.json();
  const deliveries = orderedRes.ok ? await orderedRes.json() : [];
  const scheduleByDate = buildActiveScheduleByDate(rows, weekStart, weekEnd);
  const deliveriesByDate = buildExpectedDeliveriesByDate(deliveries, weekStart, weekEnd);
  renderScheduleCalendar(weekStart, scheduleByDate, deliveriesByDate);
  renderWeeklyTasks(weekStart, scheduleByDate);
}

function renderScheduleCalendar(weekStart, scheduleByDate, deliveriesByDate) {
  const calendar = document.getElementById("scheduleCalendar");
  const range = document.getElementById("scheduleRange");
  calendar.innerHTML = "";

  range.textContent = `${formatDisplayDate(toIsoDate(weekStart))} - ${formatDisplayDate(toIsoDate(addDays(weekStart, 13)))}`;

  dayNames.forEach(dayName => {
    const header = document.createElement("div");
    header.className = "schedule-day-name";
    header.textContent = dayName;
    calendar.appendChild(header);
  });

  for (let index = 0; index < 14; index += 1) {
    const date = addDays(weekStart, index);
    const isoDate = toIsoDate(date);
    const cell = document.createElement("div");
    cell.className = "schedule-cell";
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", `View details for ${formatDisplayDate(isoDate)}`);

    const dateLabel = document.createElement("div");
    dateLabel.className = "schedule-date";
    dateLabel.textContent = formatDisplayDate(isoDate);
    cell.appendChild(dateLabel);

    const scheduleDay = scheduleByDate.get(isoDate) || { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [] };
    const deliveries = deliveriesByDate.get(isoDate) || [];
    appendEventList(cell, scheduleDay.events || []);
    appendBatchList(cell, scheduleDay);
    appendExpectedDeliveries(cell, deliveries);
    appendTestPickupList(cell, scheduleDay.testPickups || []);

    const tasks = document.createElement("div");
    tasks.className = "schedule-tasks";
    appendCalendarTaskSummary(tasks, scheduleDay.tasks);
    cell.appendChild(tasks);
    cell.addEventListener("click", () => renderFocusedScheduleDay(isoDate, scheduleDay, deliveries));
    cell.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        renderFocusedScheduleDay(isoDate, scheduleDay, deliveries);
      }
    });

    calendar.appendChild(cell);
  }
}

function renderWeeklyTasks(weekStart, scheduleByDate) {
  const container = document.getElementById("weeklyTasks");
  container.innerHTML = "";

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(weekStart, index);
    const isoDate = toIsoDate(date);
    const scheduleDay = scheduleByDate.get(isoDate) || { batchHijnx: [], batchSb: [], tasks: [] };
    if (!scheduleDay.tasks.length) continue;

    const item = document.createElement("div");
    item.className = "weekly-task-item";

    const dateLabel = document.createElement("div");
    dateLabel.className = "weekly-task-date";
    dateLabel.textContent = `${dayNames[date.getDay()]} ${formatDisplayDate(isoDate)}`;
    item.appendChild(dateLabel);

    const tasks = document.createElement("div");
    tasks.className = "schedule-tasks";
    appendTaskList(tasks, scheduleDay.tasks);
    item.appendChild(tasks);

    container.appendChild(item);
  }

  if (!container.children.length) {
    const empty = document.createElement("div");
    empty.className = "empty-entries";
    empty.textContent = "No weekly tasks scheduled.";
    container.appendChild(empty);
  }
}

async function loadOrderedItems() {
  const res = await fetch("/ordered-items");
  if (!res.ok) return;

  orderedItems = await res.json();
  renderDeliveries();
}

async function loadOrderRequests() {
  const res = await fetch("/order-requests");
  if (!res.ok) return;

  orderRequests = await res.json();
  renderOrderRequests();
}

async function loadOrderedTab() {
  await Promise.all([
    loadOrderedItems(),
    loadOrderRequests()
  ]);
}

function resetOrderRequestForm() {
  const dateInput = document.getElementById("request_date");
  if (!dateInput) return;

  dateInput.value = toIsoDate(new Date());
  document.getElementById("requester_name").value = "";
  document.getElementById("request_department").value = "";
  document.getElementById("request_item_needed").value = "";
  document.getElementById("request_qty_needed").value = "";
  document.getElementById("request_suggested_retailer").value = "";
}

function setupTimeInput(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.pattern = "([01]\\d|2[0-3]):[0-5]\\d";
  input.title = "Time as HH:MM";
  input.addEventListener("input", () => {
    input.value = input.value
      .replace(/[^\d:]/g, "")
      .replace(/^(\d{2})(\d)/, "$1:$2")
      .slice(0, 5);
  });
}

function resetManualReceivedForm() {
  const dateOrdered = document.getElementById("manual_received_date_ordered");
  if (!dateOrdered) return;

  const today = toIsoDate(new Date());
  dateOrdered.value = today;
  document.getElementById("manual_received_expected_delivery_date").value = today;
  document.getElementById("manual_received_item_name").value = "";
  document.getElementById("manual_received_package_qty").value = "";
  document.getElementById("manual_received_units_per_package").value = "";
  document.getElementById("manual_received_item_supplier").value = "";
  document.getElementById("manual_received_department").value = "";
  document.getElementById("manual_received_date").value = today;
  document.getElementById("manual_received_time").value = "";
  document.getElementById("manual_received_location").value = "";
}

function openManualReceivedWindow() {
  const modal = document.getElementById("manualReceivedWindow");
  if (!modal) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  const firstField = document.getElementById("manual_received_item_name");
  if (firstField) firstField.focus();
}

function closeManualReceivedWindow() {
  const modal = document.getElementById("manualReceivedWindow");
  if (!modal) return;

  modal.hidden = true;
  document.body.style.overflow = "";
}

function isMobileOrderedView() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function toggleMobileOrderedPanel(button) {
  const panel = button.closest(".ordered-card, .ordered-section");
  if (!panel) return;

  const willFocus = !panel.classList.contains("mobile-focused");
  document
    .querySelectorAll("#orderedTab .ordered-card.mobile-focused, #orderedTab .ordered-section.mobile-focused")
    .forEach(openPanel => {
      if (openPanel !== panel) openPanel.classList.remove("mobile-focused");
    });

  panel.classList.toggle("mobile-focused", willFocus);

  if (willFocus && isMobileOrderedView()) {
    panel.scrollIntoView({ block: "start", behavior: "smooth" });
    const firstField = panel.querySelector("input, select, textarea, button:not(.ordered-mobile-toggle)");
    if (firstField) firstField.focus({ preventScroll: true });
  }
}

async function saveOrderRequest() {
  const payload = {
    request_date: document.getElementById("request_date").value,
    requester_name: document.getElementById("requester_name").value,
    department: document.getElementById("request_department").value,
    item_needed: document.getElementById("request_item_needed").value,
    qty_needed: document.getElementById("request_qty_needed").value,
    suggested_retailer: document.getElementById("request_suggested_retailer").value
  };

  const res = await fetch("/order-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Request failed: " + text);
    return;
  }

  resetOrderRequestForm();
  await loadOrderRequests();
  alert("Request submitted");
}

async function saveManualReceivedItem() {
  const receivedTime = document.getElementById("manual_received_time").value.trim();
  if (receivedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(receivedTime)) {
    alert("Received time must use HH:MM format");
    return;
  }

  const payload = {
    date_ordered: document.getElementById("manual_received_date_ordered").value,
    expected_delivery_date: document.getElementById("manual_received_expected_delivery_date").value,
    item_name: document.getElementById("manual_received_item_name").value,
    package_qty: document.getElementById("manual_received_package_qty").value,
    units_per_package: document.getElementById("manual_received_units_per_package").value,
    item_supplier: document.getElementById("manual_received_item_supplier").value,
    department: document.getElementById("manual_received_department").value,
    received_date: document.getElementById("manual_received_date").value,
    received_time: receivedTime,
    received_location: document.getElementById("manual_received_location").value
  };

  const res = await fetch("/ordered-items/received", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Received item save failed: " + text);
    return;
  }

  resetManualReceivedForm();
  closeManualReceivedWindow();
  await loadOrderedItems();
  alert("Received item added");
}

async function importMainOrderedPdf() {
  const fileInput = document.getElementById("main_ordered_import_pdf");
  const departmentInput = document.getElementById("main_ordered_import_department");
  const result = document.getElementById("mainOrderedImportResult");
  const file = fileInput.files[0];
  const department = departmentInput.value.trim();

  result.textContent = "";

  if (!file) {
    alert("Choose an invoice or order PDF to import.");
    return;
  }

  if (!department) {
    alert("Department is required for imported order items.");
    departmentInput.focus();
    return;
  }

  const res = await fetch(`/ordered-items/import-pdf?department=${encodeURIComponent(department)}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: file
  });

  if (!res.ok) {
    const text = await res.text();
    alert("PDF import failed: " + text);
    return;
  }

  const imported = await res.json();
  fileInput.value = "";
  result.textContent = [
    `Imported ${imported.items.length} item${imported.items.length === 1 ? "" : "s"}.`,
    `${imported.received || 0} delivered, ${imported.needs_delivery_date || 0} need delivery date.`
  ].join("\n");
  await loadOrderedItems();
}

function renderOrderRequests() {
  const container = document.getElementById("orderRequests");
  const count = document.getElementById("orderRequestsCount");
  const mobileCount = document.getElementById("orderRequestsMobileCount");
  const openRequests = orderRequests.filter(request => !request.ordered_item_id);
  container.innerHTML = "";
  if (count) {
    count.textContent = `${openRequests.length} open`;
  }
  if (mobileCount) {
    mobileCount.textContent = `${openRequests.length} open`;
  }

  if (!openRequests.length) {
    const empty = document.createElement("div");
    empty.className = "empty-entries";
    empty.textContent = "No item requests yet.";
    container.appendChild(empty);
    return;
  }

  openRequests.forEach(request => {
    const card = document.createElement("div");
    card.className = "delivery-card request";

    const title = document.createElement("div");
    title.className = "delivery-title";
    title.textContent = request.item_needed;
    card.appendChild(title);

    const details = document.createElement("div");
    details.className = "delivery-details";
    appendDeliveryDetail(details, "Date", request.request_date);
    appendDeliveryDetail(details, "Name", request.requester_name);
    appendDeliveryDetail(details, "Department", request.department);
    appendDeliveryDetail(details, "QTY Needed", request.qty_needed);
    appendDeliveryDetail(details, "Suggested Retailer", request.suggested_retailer);
    appendDeliveryDetail(details, "Status", request.status);
    card.appendChild(details);

    container.appendChild(card);
  });
}

function appendDeliveryDetail(container, label, value) {
  if (value === undefined || value === null || value === "") return;

  const detail = document.createElement("div");
  const labelElement = document.createElement("b");
  labelElement.textContent = `${label}: `;
  detail.appendChild(labelElement);
  detail.appendChild(document.createTextNode(value));
  container.appendChild(detail);
}

function createDeliveryDetails(item) {
  const details = document.createElement("div");
  details.className = "delivery-details";

  appendDeliveryDetail(details, "Date Ordered", item.date_ordered);
  appendDeliveryDetail(details, "Expected", item.expected_delivery_date);
  appendDeliveryDetail(details, "Company", item.item_company);
  appendDeliveryDetail(details, "Package QTY", item.package_qty);
  appendDeliveryDetail(details, "Units/Package", item.units_per_package);
  appendDeliveryDetail(details, "Supplier", item.item_supplier);
  appendDeliveryDetail(details, "Department", item.department);
  appendDeliveryDetail(details, "Requested By", item.requested_by);
  if (Number(item.import_needs_delivery_date)) {
    appendDeliveryDetail(details, "Needs Delivery Date", "Yes");
  }

  if (item.received_date) {
    appendDeliveryDetail(details, "Received", item.received_date);
    appendDeliveryDetail(details, "Time", item.received_time);
    appendDeliveryDetail(details, "Location", item.received_location);
  }

  return details;
}

function createDeliveryCard(item, isReceived) {
  const card = document.createElement("div");
  card.className = isReceived ? "delivery-card received" : "delivery-card";

  const title = document.createElement("div");
  title.className = "delivery-title";
  title.textContent = item.item_name;
  title.tabIndex = 0;
  title.setAttribute("role", "button");
  title.setAttribute("aria-expanded", "false");
  title.addEventListener("click", () => toggleMobileDeliveryCard(card, title));
  title.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMobileDeliveryCard(card, title);
    }
  });
  card.appendChild(title);
  card.appendChild(createDeliveryDetails(item));

  if (isReceived) {
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.textContent = "Undo";
    undoButton.addEventListener("click", () => undoReceivedItem(item.id));
    card.appendChild(undoButton);
    return card;
  }

  const toggleLabel = document.createElement("label");
  toggleLabel.className = "receive-toggle";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      showReceivePrompt(card, item.id);
    }
  });

  toggleLabel.appendChild(checkbox);
  toggleLabel.appendChild(document.createTextNode("Received"));
  card.appendChild(toggleLabel);

  return card;
}

function toggleMobileDeliveryCard(card, title) {
  if (!isMobileOrderedView()) return;

  const willFocus = !card.classList.contains("mobile-focused");
  card.parentElement
    .querySelectorAll(".delivery-card.mobile-focused")
    .forEach(openCard => {
      if (openCard !== card) {
        openCard.classList.remove("mobile-focused");
        const openTitle = openCard.querySelector(".delivery-title");
        if (openTitle) openTitle.setAttribute("aria-expanded", "false");
      }
    });

  card.classList.toggle("mobile-focused", willFocus);
  title.setAttribute("aria-expanded", String(willFocus));

  if (willFocus) {
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function showReceivePrompt(card, itemId) {
  const existingRow = card.querySelector(".receive-row");
  if (existingRow) {
    existingRow.querySelector("input").focus();
    return;
  }

  const row = document.createElement("div");
  row.className = "receive-row";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = toIsoDate(new Date());
  dateInput.setAttribute("aria-label", "Received Date");
  row.appendChild(dateInput);

  const locationInput = document.createElement("input");
  locationInput.type = "text";
  locationInput.placeholder = "Received Location";
  row.appendChild(locationInput);

  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.placeholder = "00:00";
  timeInput.inputMode = "numeric";
  timeInput.maxLength = 5;
  timeInput.pattern = "([01]\\d|2[0-3]):[0-5]\\d";
  timeInput.title = "Received time as HH:MM";
  timeInput.addEventListener("input", () => {
    timeInput.value = timeInput.value
      .replace(/[^\d:]/g, "")
      .replace(/^(\d{2})(\d)/, "$1:$2")
      .slice(0, 5);
  });
  row.appendChild(timeInput);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save Received";
  saveButton.addEventListener("click", () => receiveOrderedItem(
    itemId,
    dateInput.value,
    locationInput.value,
    timeInput.value
  ));
  row.appendChild(saveButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    const checkbox = card.querySelector(".receive-toggle input");
    checkbox.checked = false;
    row.remove();
  });
  row.appendChild(cancelButton);

  card.appendChild(row);
  locationInput.focus();
}

async function receiveOrderedItem(itemId, receivedDate, receivedLocation, receivedTime = "") {
  if (!receivedDate || !receivedLocation.trim()) {
    alert("Received date and location are required");
    return;
  }

  if (receivedTime.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(receivedTime.trim())) {
    alert("Received time must use HH:MM format");
    return;
  }

  const res = await fetch(`/ordered-items/${itemId}/receive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      received_date: receivedDate,
      received_location: receivedLocation,
      received_time: receivedTime.trim()
    })
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Receive failed: " + text);
    return;
  }

  await loadOrderedItems();
}

async function undoReceivedItem(itemId) {
  const res = await fetch(`/ordered-items/${itemId}/undo-receive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Undo failed: " + text);
    return;
  }

  await loadOrderedItems();
}

function renderDeliveryList(container, items, isReceived, emptyText = "") {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-entries";
    empty.textContent = emptyText || (isReceived
      ? "No received deliveries yet."
      : "No expected deliveries.");
    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    container.appendChild(createDeliveryCard(item, isReceived));
  });
}

function renderDeliveries() {
  const needsDeliveryDate = orderedItems.filter(item => !item.received_date && Number(item.import_needs_delivery_date));
  const expected = orderedItems.filter(item => !item.received_date && !Number(item.import_needs_delivery_date));
  const received = orderedItems.filter(item => item.received_date);
  const expectedCount = document.getElementById("expectedDeliveriesCount");
  const needsDeliveryDateCount = document.getElementById("needsDeliveryDateCount");
  const receivedCount = document.getElementById("receivedDeliveriesCount");

  if (expectedCount) {
    expectedCount.textContent = `${expected.length} expected`;
  }
  const expectedMobileCount = document.getElementById("expectedDeliveriesMobileCount");
  if (expectedMobileCount) {
    expectedMobileCount.textContent = `${expected.length} expected`;
  }
  if (needsDeliveryDateCount) {
    needsDeliveryDateCount.textContent = `${needsDeliveryDate.length} need date`;
  }
  const needsDeliveryDateMobileCount = document.getElementById("needsDeliveryDateMobileCount");
  if (needsDeliveryDateMobileCount) {
    needsDeliveryDateMobileCount.textContent = `${needsDeliveryDate.length} need date`;
  }
  if (receivedCount) {
    receivedCount.textContent = `${received.length} received`;
  }
  const receivedMobileCount = document.getElementById("receivedDeliveriesMobileCount");
  if (receivedMobileCount) {
    receivedMobileCount.textContent = `${received.length} received`;
  }

  renderDeliveryList(document.getElementById("expectedDeliveries"), expected, false);
  renderDeliveryList(
    document.getElementById("needsDeliveryDateDeliveries"),
    needsDeliveryDate,
    false,
    "No imported deliveries need a delivery date."
  );
  renderDeliveryList(document.getElementById("receivedDeliveries"), received, true);
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeManualReceivedWindow();
  }
});

load();
