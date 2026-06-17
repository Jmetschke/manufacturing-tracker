let timerInterval = null;
let startTime = null;
let currentLogId = null;
let loadedItems = [];
let loadedTasks = [];
let itemTaskOptionsByItemId = {};
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
const batchChecklistItems = [
  { key: "cooking", label: "Cooking" },
  { key: "postCookingProcessing", label: "Post cooking processing" },
  { key: "packaging", label: "Packaging" },
  { key: "sealed", label: "Sealed" },
  { key: "counted", label: "Counted" },
  { key: "finalCountEnteredMetrc", label: "Final count entered in Metrc" }
];

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

function renderTaskOptions(itemId, selectedTaskId = "") {
  const taskSel = document.getElementById("task");
  if (!taskSel) return;

  const allowedTaskIds = new Set((itemTaskOptionsByItemId[String(itemId)] || []).map(String));
  const taskOptions = loadedTasks.filter(task => allowedTaskIds.has(String(task.id)));

  taskSel.innerHTML = "";

  const taskPlaceholder = document.createElement("option");
  taskPlaceholder.value = "";
  taskPlaceholder.text = itemId ? "Select Task" : "Select Item First";
  taskSel.appendChild(taskPlaceholder);

  taskOptions.forEach(task => {
    const option = document.createElement("option");
    option.value = task.id;
    option.text = task.name;
    taskSel.appendChild(option);
  });

  if (selectedTaskId && taskOptions.some(task => String(task.id) === String(selectedTaskId))) {
    taskSel.value = String(selectedTaskId);
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

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeBatchList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === "object") {
          const checklist = item.checklist && typeof item.checklist === "object" ? item.checklist : {};
          return {
            item: String(item.item || "").trim(),
            units: String(item.units || "").trim(),
            checklist: Object.fromEntries(
              batchChecklistItems.map(check => [check.key, Boolean(checklist[check.key])])
            )
          };
        }

        return {
          item: String(item || "").trim(),
          units: "",
          checklist: {}
        };
      })
      .filter(batch => batch.item);
  }

  const singleValue = String(value || "").trim();
  return singleValue ? [{ item: singleValue, units: "", checklist: {} }] : [];
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
    testPickups: [],
    processingTasks: []
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
        testPickups: normalizeTestPickups(parsed.testPickups),
        processingTasks: normalizeProcessingTasks(parsed.processingTasks)
      };
    }

    if (Array.isArray(parsed)) {
      return {
        ...empty,
        tasks: parsed
          .map(normalizeScheduleTask)
          .filter(task => task.text),
        testPickups: [],
        processingTasks: []
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
    testPickups: [],
    processingTasks: []
  };
}

function normalizeProcessingTasks(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (item && typeof item === "object") {
        return normalizeScheduleTask(item);
      }

      return {
        text: String(item || "").trim(),
        days: 1,
        totalHours: 0,
        assignments: []
      };
    })
    .filter(task => task.text);
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
  const item = String(task && task.item ? task.item : "").trim();
  const units = Math.max(0, Number.parseFloat(task && task.units) || 0);
  const scheduleDate = isIsoDate(task && task.scheduleDate) ? task.scheduleDate : "";
  const days = Math.max(1, Number.parseInt(task && task.days, 10) || 1);
  const totalHours = Math.max(0, Number.parseFloat(task && task.totalHours) || 0);
  const sourceBatchKey = String(task && task.sourceBatchKey ? task.sourceBatchKey : "").trim();
  const sourceBatchLabel = String(task && task.sourceBatchLabel ? task.sourceBatchLabel : "").trim();
  const sourceTaskOrder = Number.parseInt(task && task.sourceTaskOrder, 10);
  const completedDates = Array.isArray(task && task.completedDates)
    ? task.completedDates.filter(isIsoDate)
    : [];

  return {
    text,
    item,
    units,
    scheduleDate,
    days,
    totalHours,
    assignments: normalizeScheduleAssignments(task && task.assignments, days),
    sourceBatchKey,
    sourceBatchLabel,
    sourceTaskOrder: Number.isFinite(sourceTaskOrder) ? sourceTaskOrder : null,
    autoGenerated: Boolean(task && task.autoGenerated),
    completedDates
  };
}

function getTaskDisplayText(task) {
  return task.item ? `${task.item} - ${task.text}` : task.text;
}

function formatTaskHours(value) {
  const hours = Number.parseFloat(value);
  if (!Number.isFinite(hours)) return "0 hrs";
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })} hr${rounded === 1 ? "" : "s"}`;
}

const batchTaskColors = [
  { background: "#eef5fb", border: "#2364aa", text: "#123c69" },
  { background: "#f1f8ea", border: "#5d9b45", text: "#24451c" },
  { background: "#fff5df", border: "#d08a1f", text: "#5a3a10" },
  { background: "#f5eefb", border: "#7a4fb0", text: "#3f285c" },
  { background: "#eef8f6", border: "#258579", text: "#174f48" },
  { background: "#fdeff2", border: "#c7556b", text: "#6c2635" }
];

function getBatchColorIndex(sourceBatchKey) {
  const key = String(sourceBatchKey || "");
  let total = 0;
  for (let index = 0; index < key.length; index += 1) {
    total = (total + key.charCodeAt(index) * (index + 1)) % batchTaskColors.length;
  }
  return total;
}

function getBatchColorKey(task) {
  if (!task) return "";
  const label = String(task.sourceBatchLabel || "").trim();
  if (label) return label;

  const key = String(task.sourceBatchKey || "").trim();
  const parts = key.split(":");
  if (parts.length >= 5) {
    return parts.slice(0, 3).join(":");
  }
  return key;
}

function applyBatchTaskColor(element, task) {
  if (!task || !task.sourceBatchKey) return;
  const color = batchTaskColors[getBatchColorIndex(getBatchColorKey(task))];
  element.classList.add("batch-colored-task");
  element.style.setProperty("--batch-task-bg", color.background);
  element.style.setProperty("--batch-task-border", color.border);
  element.style.setProperty("--batch-task-text", color.text);
  element.title = task.sourceBatchLabel || "";
}

function appendTaskList(container, tasks) {
  if (!tasks.length) return;

  const list = document.createElement("ol");
  list.className = "schedule-task-list schedule-kitchen-task-list";

  tasks.forEach(task => {
    const item = document.createElement("li");
    applyBatchTaskColor(item, task);
    const parts = [getTaskDisplayText(task)];
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
    const key = `${task.taskType || ""}\n${task.sourceScheduleDate || ""}\n${task.sourceTaskIndex ?? ""}\n${task.sourceBatchKey || ""}\n${task.item || ""}\n${task.text}`;
    if (!groups.has(key)) {
      groups.set(key, {
        item: task.item || "",
        text: task.text,
        taskType: task.taskType || "tasks",
        sourceScheduleDate: task.sourceScheduleDate || "",
        sourceTaskIndex: Number.isInteger(task.sourceTaskIndex) ? task.sourceTaskIndex : null,
        activeDate: task.activeDate || "",
        sourceBatchKey: task.sourceBatchKey || "",
        sourceBatchLabel: task.sourceBatchLabel || "",
        assignedHours: 0,
        neededHours: 0,
        remainingHours: task.remainingHours,
        people: new Map(),
        legacyDays: task.days || 1,
        completed: Boolean(task.completed),
        taskCount: 0,
        completedCount: 0
      });
    }

    const group = groups.get(key);
    group.taskCount += 1;
    if (task.completed) group.completedCount += 1;
    group.completed = group.completedCount === group.taskCount;
    if (task.hours) {
      group.assignedHours += task.hours;
    }
    if (task.neededHours) {
      group.neededHours += task.neededHours;
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

function createProjectedTask(task, row, taskType, taskIndex, activeDate, dayIndex, overrides = {}) {
  return {
    item: task.item,
    text: task.text,
    days: task.days,
    totalHours: task.totalHours,
    neededHours: task.totalHours,
    units: task.units,
    scheduleDate: task.scheduleDate,
    sourceBatchKey: task.sourceBatchKey,
    sourceBatchLabel: task.sourceBatchLabel,
    sourceTaskOrder: task.sourceTaskOrder,
    sourceScheduleDate: row.schedule_date,
    sourceTaskIndex: taskIndex,
    taskType,
    activeDate,
    dayIndex,
    completed: (task.completedDates || []).includes(activeDate),
    ...overrides
  };
}

async function toggleScheduleTaskCompletion(task, completed, checkbox) {
  if (!task.sourceScheduleDate || !task.activeDate || !Number.isInteger(task.sourceTaskIndex)) return;

  checkbox.disabled = true;
  const previous = !completed;

  try {
    const res = await fetch("/schedule/task-completion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceDate: task.sourceScheduleDate,
        activeDate: task.activeDate,
        taskType: task.taskType || "tasks",
        taskIndex: task.sourceTaskIndex,
        task: {
          item: task.item,
          text: task.text,
          units: task.units,
          scheduleDate: task.scheduleDate || task.sourceScheduleDate,
          totalHours: task.totalHours,
          days: task.days,
          assignments: [],
          autoGenerated: Boolean(task.sourceBatchKey),
          sourceBatchKey: task.sourceBatchKey,
          sourceBatchLabel: task.sourceBatchLabel,
          sourceTaskOrder: task.sourceTaskOrder,
          completedDates: []
        },
        completed
      })
    });

    if (!res.ok) throw new Error(await res.text());
    await loadSchedule();
  } catch (err) {
    checkbox.checked = previous;
    checkbox.closest(".calendar-focus-item")?.classList.toggle("task-completed", previous);
    alert(err.message || "Could not update task completion.");
  } finally {
    checkbox.disabled = false;
  }
}

function appendTaskCompletionControl(item, task) {
  if (!task.sourceScheduleDate || !task.activeDate || !Number.isInteger(task.sourceTaskIndex)) return;

  const label = document.createElement("label");
  label.className = "task-completion-control";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(task.completed);
  checkbox.addEventListener("change", () => {
    item.classList.toggle("task-completed", checkbox.checked);
    toggleScheduleTaskCompletion(task, checkbox.checked, checkbox);
  });

  label.appendChild(checkbox);
  label.append(document.createTextNode("Completed"));
  item.appendChild(label);
  item.classList.toggle("task-completed", checkbox.checked);
}

function appendCalendarTaskSummary(container, tasks) {
  if (!tasks.length) return;

  const heading = document.createElement("div");
  heading.className = "calendar-kitchen-heading";
  heading.textContent = "Kitchen Tasks";
  container.appendChild(heading);

  const list = document.createElement("ol");
  list.className = "schedule-task-list schedule-kitchen-task-list";

  groupDailyTaskAssignments(tasks).forEach(task => {
    const item = document.createElement("li");
    applyBatchTaskColor(item, task);
    item.textContent = task.assignedHours > 0
      ? `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)}`
      : task.legacyDays > 1
        ? `${getTaskDisplayText(task)} - ${task.legacyDays} days`
        : getTaskDisplayText(task);
    list.appendChild(item);
  });

  container.appendChild(list);
}

function appendTaskFocusDetails(block, projectedTasks, emptyText) {
  const groups = groupDailyTaskAssignments(projectedTasks);
  if (!groups.length) {
    block.appendChild(createFocusEmpty(emptyText));
    return;
  }

  groups.forEach(task => {
    const item = document.createElement("div");
    item.className = "calendar-focus-item";
    applyBatchTaskColor(item, task);
    const titleLine = document.createElement("b");
    titleLine.className = "calendar-task-title";
    const hoursText = task.assignedHours > 0
      ? `${formatTaskHours(task.assignedHours)} assigned`
      : Number.isFinite(task.neededHours)
        ? `${formatTaskHours(task.neededHours)} needed`
        : "No hours assigned";
    titleLine.textContent = `${getTaskDisplayText(task)} - ${hoursText}`;
    item.appendChild(titleLine);
    appendTaskCompletionControl(item, task);

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
    } else if (!task.neededHours) {
      item.appendChild(createFocusEmpty("No person hours assigned for this day."));
    }

    if (Number.isFinite(task.remainingHours)) {
      const remaining = document.createElement("div");
      remaining.textContent = `${formatTaskHours(task.remainingHours)} remaining after this day`;
      item.appendChild(remaining);
    }

    block.appendChild(item);
  });
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

function getBatchProgress(batch) {
  const checklist = batch.checklist || {};
  const completed = batchChecklistItems.filter(check => checklist[check.key]).length;
  return {
    completed,
    total: batchChecklistItems.length,
    percent: batchChecklistItems.length ? Math.round((completed / batchChecklistItems.length) * 100) : 0
  };
}

function getBatchStatusText(batch) {
  const progress = getBatchProgress(batch);
  if (progress.completed === 0) return "Not started";
  if (progress.completed === progress.total) return "Completed";
  return `${progress.percent}% complete`;
}

function getGeneratedBatchKey(batchType, batchIndex, batchItem) {
  return `${batchType}:${batchIndex}:${batchItem}`;
}

function isBatchInProgress(batch) {
  const progress = getBatchProgress(batch);
  return progress.completed < progress.total;
}

function getPayloadBatchesByKey(payload) {
  const batchesByKey = new Map();

  [
    ...payload.batchHijnx.map((batch, index) => ({ type: "hijnx", index, batch })),
    ...payload.batchSb.map((batch, index) => ({ type: "sb", index, batch }))
  ].forEach(({ type, index, batch }) => {
    batchesByKey.set(getGeneratedBatchKey(type, index, batch.item), batch);
  });

  return batchesByKey;
}

function taskWasCompletedOn(task, isoDate) {
  return (task.completedDates || []).includes(isoDate);
}

function taskWasCompleted(task) {
  return (task.completedDates || []).length > 0;
}

function appendBatchDetail(container, batch) {
  const item = document.createElement("div");
  item.className = "calendar-focus-item";

  const title = document.createElement("b");
  title.className = "calendar-focus-batch-name";
  title.textContent = batch.item || "Production batch";
  item.appendChild(title);

  const units = document.createElement("span");
  units.className = "calendar-focus-batch-units";
  units.textContent = batch.units ? `${batch.units} units` : "Units not set";
  item.appendChild(units);

  container.appendChild(item);
}

function countGroupedTasks(tasks) {
  return groupDailyTaskAssignments(tasks).length;
}

function createDailyReportCard({ title, count, note, className, onFocus }) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `daily-report-card ${className}`;
  card.addEventListener("click", onFocus);

  const heading = document.createElement("h4");
  heading.textContent = title;
  card.appendChild(heading);

  const countElement = document.createElement("div");
  countElement.className = "daily-report-card-count";
  countElement.textContent = String(count);
  card.appendChild(countElement);

  const noteElement = document.createElement("div");
  noteElement.className = "daily-report-card-note";
  noteElement.textContent = note;
  card.appendChild(noteElement);

  return card;
}

function showDailyReportFocus(titleText, fill) {
  const panel = document.getElementById("dailyReportFocus");
  const title = document.getElementById("dailyReportFocusTitle");
  const body = document.getElementById("dailyReportFocusBody");
  if (!panel || !title || !body) return;

  title.textContent = titleText;
  body.innerHTML = "";
  fill(body);
  panel.hidden = false;
  const closeButton = panel.querySelector("button");
  if (closeButton) closeButton.focus();
}

function closeDailyReportFocus() {
  const panel = document.getElementById("dailyReportFocus");
  const body = document.getElementById("dailyReportFocusBody");
  if (!panel) return;

  panel.hidden = true;
  if (body) body.innerHTML = "";
}

function getBatchesFromScheduleRows(rows) {
  return rows.flatMap(row => {
    const payload = parseSchedulePayload(row.tasks);
    return [
      ...payload.batchHijnx.map(batch => ({ label: "Hijnx", scheduleDate: row.schedule_date, ...batch })),
      ...payload.batchSb.map(batch => ({ label: "SB", scheduleDate: row.schedule_date, ...batch }))
    ];
  });
}

function renderDailyWorkingBatches(batches) {
  const container = document.getElementById("dailyWorkingBatches");
  container.innerHTML = "";

  const workingBatches = batches.filter(batch => {
    const progress = getBatchProgress(batch);
    return progress.completed < progress.total;
  });

  if (!workingBatches.length) {
    const empty = document.createElement("div");
    empty.className = "calendar-focus-empty";
    empty.textContent = "No working batches.";
    container.appendChild(empty);
    return;
  }

  workingBatches.forEach(batch => {
    const progress = getBatchProgress(batch);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "daily-working-batch";
    card.addEventListener("click", () => showDailyReportFocus("Working Batch", body => appendBatchDetail(body, batch)));

    const pie = document.createElement("div");
    pie.className = "daily-batch-pie";
    pie.style.setProperty("--progress", `${progress.percent}%`);
    card.appendChild(pie);

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "daily-working-batch-title";
    title.textContent = `${batch.label}: ${batch.item}`;
    text.appendChild(title);

    if (batch.scheduleDate) {
      const scheduled = document.createElement("div");
      scheduled.className = "daily-working-batch-note";
      scheduled.textContent = formatDisplayDate(batch.scheduleDate);
      text.appendChild(scheduled);
    }

    const note = document.createElement("div");
    note.className = "daily-working-batch-note";
    note.textContent = getBatchStatusText(batch);
    text.appendChild(note);

    card.appendChild(text);
    container.appendChild(card);
  });
}

async function loadDailyReport() {
  const today = toIsoDate(new Date());
  const todayDate = dateOnly(new Date());
  const from = toIsoDate(addDays(todayDate, -3650));
  const scheduleRes = await fetch(`/schedule?from=${from}&to=${today}`);

  if (!scheduleRes.ok) {
    return;
  }

  const rows = await scheduleRes.json();
  const scheduleByDate = buildActiveScheduleByDate(rows, todayDate, todayDate);
  const scheduleDay = scheduleByDate.get(today) || {
    batchHijnx: [],
    batchSb: [],
    events: [],
    tasks: [],
    testPickups: [],
    processingTasks: []
  };
  const batches = [
    ...(scheduleDay.batchHijnx || []).map(batch => ({ label: "Hijnx", ...batch })),
    ...(scheduleDay.batchSb || []).map(batch => ({ label: "SB", ...batch }))
  ];
  const workingBatches = getBatchesFromScheduleRows(rows);

  document.getElementById("dailyReportTitle").textContent = `Daily Report - ${formatDisplayDate(today)}`;
  closeDailyReportFocus();

  const grid = document.getElementById("dailyReportGrid");
  grid.innerHTML = "";

  const cards = [
    createDailyReportCard({
      title: "Production Batches",
      count: batches.length,
      note: batches.length ? "Tap to review batch details" : "No batches scheduled",
      className: "batches",
      onFocus: () => showDailyReportFocus("Production Batches", body => {
        if (!batches.length) {
          body.appendChild(createFocusEmpty("No production batches."));
          return;
        }
        batches.forEach(batch => appendBatchDetail(body, batch));
      })
    }),
    createDailyReportCard({
      title: "Kitchen Tasks",
      count: countGroupedTasks(scheduleDay.tasks || []),
      note: scheduleDay.tasks.length ? "Tap to review assignments" : "No kitchen tasks scheduled",
      className: "kitchen",
      onFocus: () => showDailyReportFocus("Kitchen Tasks", body => appendTaskFocusDetails(body, scheduleDay.tasks || [], "No kitchen tasks scheduled."))
    }),
    createDailyReportCard({
      title: "Processing Tasks",
      count: countGroupedTasks(scheduleDay.processingTasks || []),
      note: scheduleDay.processingTasks.length ? "Tap to review assignments" : "No processing tasks scheduled",
      className: "processing",
      onFocus: () => showDailyReportFocus("Processing Tasks", body => appendTaskFocusDetails(body, scheduleDay.processingTasks || [], "No processing tasks."))
    }),
    createDailyReportCard({
      title: "Events",
      count: scheduleDay.events.length,
      note: scheduleDay.events.length ? "Tap to review event details" : "No events scheduled",
      className: "events",
      onFocus: () => showDailyReportFocus("Events", body => appendFocusLines(body, scheduleDay.events || [], event => {
        const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
        return `${event.title}${timeText} - ${event.location} - ${event.company}`;
      }, "No events scheduled."))
    }),
    createDailyReportCard({
      title: "Test Pick Ups",
      count: scheduleDay.testPickups.length,
      note: scheduleDay.testPickups.length ? "Tap to review pickup details" : "No test pick ups scheduled",
      className: "pickups",
      onFocus: () => showDailyReportFocus("Test Pick Ups", body => appendFocusLines(body, scheduleDay.testPickups || [], pickup =>
        `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`,
      "No test pick ups."))
    })
  ];

  cards.forEach(card => grid.appendChild(card));
  renderDailyWorkingBatches(workingBatches);
}

function renderFocusedScheduleDay(isoDate, scheduleDay, deliveries) {
  const panel = document.getElementById("scheduleDayFocus");
  const title = document.getElementById("scheduleDayFocusTitle");
  const body = document.getElementById("scheduleDayFocusBody");
  if (!panel || !title || !body) return;

  title.textContent = formatDisplayDate(isoDate);
  body.innerHTML = "";

  const section = (headingText, fill, className = "") => {
    const block = document.createElement("div");
    block.className = `calendar-focus-section ${className}`.trim();
    const heading = document.createElement("h4");
    heading.textContent = headingText;
    block.appendChild(heading);
    fill(block);
    body.appendChild(block);
  };

  section("Events", block => appendFocusLines(block, scheduleDay.events || [], event => {
    const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
    return `${event.title}${timeText} - ${event.location} - ${event.company}`;
  }, "No events scheduled."), "focus-events");

  section("Production Batches", block => {
    const batches = [
      ...(scheduleDay.batchHijnx || []).map(batch => ({ label: "Hijnx", ...batch })),
      ...(scheduleDay.batchSb || []).map(batch => ({ label: "SB", ...batch }))
    ];

    if (!batches.length) {
      block.appendChild(createFocusEmpty("No production batches."));
      return;
    }

    batches.forEach(batch => appendBatchDetail(block, batch));
  }, "focus-batches");

  section("Kitchen Tasks", block => appendTaskFocusDetails(block, scheduleDay.tasks || [], "No kitchen tasks scheduled."), "focus-kitchen");

  section("Deliveries", block => appendFocusLines(block, deliveries, delivery =>
    `${delivery.calendar_delivery_status}: ${delivery.item_name} - QTY ${delivery.package_qty || ""}`.trim(),
  "No deliveries."), "focus-deliveries");

  section("Test Pick Ups", block => appendFocusLines(block, scheduleDay.testPickups || [], pickup =>
    `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`,
  "No test pick ups."), "focus-pickups");

  section("Processing Tasks", block => appendTaskFocusDetails(block, scheduleDay.processingTasks || [], "No processing tasks."), "focus-processing");

  panel.hidden = false;
  const closeButton = panel.querySelector("button");
  if (closeButton) closeButton.focus();
}

function closeScheduleDayFocus() {
  const panel = document.getElementById("scheduleDayFocus");
  const body = document.getElementById("scheduleDayFocusBody");
  if (!panel) return;

  panel.hidden = true;
  if (body) body.innerHTML = "";
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

function appendProcessingTaskList(container, processingTasks) {
  if (!processingTasks.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "calendar-processing-tasks";

  const heading = document.createElement("div");
  heading.className = "calendar-processing-heading";
  heading.textContent = "Processing Tasks";
  wrapper.appendChild(heading);

  const list = document.createElement("ol");
  list.className = "calendar-processing-task-list";

  groupDailyTaskAssignments(processingTasks).forEach(task => {
    const item = document.createElement("li");
    item.className = "calendar-processing-task";
    applyBatchTaskColor(item, task);
    item.textContent = task.assignedHours > 0
      ? `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)}`
      : task.legacyDays > 1
        ? `${getTaskDisplayText(task)} - ${task.legacyDays} days`
        : getTaskDisplayText(task);
    list.appendChild(item);
  });

  wrapper.appendChild(list);
  container.appendChild(wrapper);
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
      ? `${label}: ${batch.item} - ${batch.units} units - ${getBatchProgress(batch).percent}%`
      : `${label}: ${batch.item} - ${getBatchProgress(batch).percent}%`;
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
  const todayIso = getTodayIsoDate();

  for (let index = 0; index <= 13; index += 1) {
    activeSchedule.set(toIsoDate(addDays(rangeStart, index)), {
      batchHijnx: [],
      batchSb: [],
      events: [],
      tasks: [],
      testPickups: [],
      processingTasks: []
    });
  }

  rows.forEach(row => {
    const [year, month, day] = row.schedule_date.split("-").map(Number);
    const rowStartDate = new Date(year, month - 1, day);
    const payload = parseSchedulePayload(row.tasks);
    const batchesByKey = getPayloadBatchesByKey(payload);

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
          activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] });
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

    payload.tasks.forEach((task, taskIndex) => {
      let remainingHours = task.totalHours;
      const startDate = isIsoDate(task.scheduleDate)
        ? dateOnly(new Date(`${task.scheduleDate}T00:00:00`))
        : rowStartDate;
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
              ...createProjectedTask(task, row, "tasks", taskIndex, toIsoDate(activeDate), dayIndex),
              employee: assignment.employee,
              hours: appliedHours,
              remainingHours
            });
          });
        } else if (task.totalHours > 0) {
          projectedTasks.push(createProjectedTask(task, row, "tasks", taskIndex, toIsoDate(activeDate), dayIndex, { remainingHours }));
        } else {
          projectedTasks.push(createProjectedTask(task, row, "tasks", taskIndex, toIsoDate(activeDate), dayIndex));
        }

        if (activeDate < rangeStart || activeDate > rangeEnd) return;

        const isoDate = toIsoDate(activeDate);
        if (!activeSchedule.has(isoDate)) {
          activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] });
        }
        activeSchedule.get(isoDate).tasks.push(...projectedTasks);
      });
    });

    payload.processingTasks.forEach((task, taskIndex) => {
      if (task.autoGenerated && task.sourceBatchKey) {
        const batch = batchesByKey.get(task.sourceBatchKey) || batchesByKey.get(getBatchColorKey(task));
        for (
          let activeDate = rangeStart;
          activeDate <= rangeEnd;
          activeDate = addDays(activeDate, 1)
        ) {
          const activeDateIso = toIsoDate(activeDate);
          if (activeDateIso < row.schedule_date) continue;

          const completedOnDate = taskWasCompletedOn(task, activeDateIso);
          const isPastDay = activeDateIso < todayIso;
          const shouldShow = isPastDay
            ? completedOnDate
            : completedOnDate || (batch && isBatchInProgress(batch) && !taskWasCompleted(task));

          if (!shouldShow) continue;
          if (!activeSchedule.has(activeDateIso)) {
            activeSchedule.set(activeDateIso, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] });
          }
          activeSchedule.get(activeDateIso).processingTasks.push(createProjectedTask(task, row, "processingTasks", taskIndex, activeDateIso, 0, {
            neededHours: task.totalHours,
            remainingHours: taskWasCompleted(task) ? 0 : task.totalHours
          }));
        }
        return;
      }

      let remainingHours = task.totalHours;
      const startDate = isIsoDate(task.scheduleDate)
        ? dateOnly(new Date(`${task.scheduleDate}T00:00:00`))
        : rowStartDate;
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
              ...createProjectedTask(task, row, "processingTasks", taskIndex, toIsoDate(activeDate), dayIndex),
              employee: assignment.employee,
              hours: appliedHours,
              remainingHours
            });
          });
        } else if (task.totalHours > 0) {
          projectedTasks.push(createProjectedTask(task, row, "processingTasks", taskIndex, toIsoDate(activeDate), dayIndex, { remainingHours }));
        } else {
          projectedTasks.push(createProjectedTask(task, row, "processingTasks", taskIndex, toIsoDate(activeDate), dayIndex));
        }

        if (activeDate < rangeStart || activeDate > rangeEnd) return;

        const isoDate = toIsoDate(activeDate);
        if (!activeSchedule.has(isoDate)) {
          activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] });
        }
        activeSchedule.get(isoDate).processingTasks.push(...projectedTasks);
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

function resetCompletedEntryForm() {
  const qtyInput = document.getElementById("qty");
  const saveBtn = document.getElementById("saveBtn");

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
  updateTimerWorkflowUI();
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

  const [items, tasks, taskOptions] = await Promise.all([
    fetch("/items").then(r => r.json()),
    fetch("/tasks").then(r => r.json()),
    fetch("/item-task-options").then(r => r.json())
  ]);
  loadedItems = items;
  loadedTasks = tasks;
  itemTaskOptionsByItemId = taskOptions;

  const itemSel = document.getElementById("item");
  const taskSel = document.getElementById("task");

  itemSel.innerHTML = "";

  const itemPlaceholder = document.createElement("option");
  itemPlaceholder.value = "";
  itemPlaceholder.text = "Select Item";
  itemSel.appendChild(itemPlaceholder);

  items.forEach(i => {
    const o = document.createElement("option");
    o.value = i.id;
    o.text = i.name;
    itemSel.appendChild(o);
  });

  renderTaskOptions("");

  setupDispensaryLocations();
  updateDispensaryField();

  itemSel.addEventListener("change", () => {
    renderTaskOptions(itemSel.value);
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
  const dailyTab = document.getElementById("dailyTab");
  const orderedTab = document.getElementById("orderedTab");
  const buttons = document.querySelectorAll(".tab-button");

  closeDailyReportFocus();
  closeScheduleDayFocus();

  trackerTab.classList.toggle("active", tabName === "tracker");
  calculatorTab.classList.toggle("active", tabName === "calculator");
  scheduleTab.classList.toggle("active", tabName === "schedule");
  dailyTab.classList.toggle("active", tabName === "daily");
  orderedTab.classList.toggle("active", tabName === "ordered");

  buttons.forEach(button => {
    const labels = {
      tracker: "Timer",
      calculator: "Qty Calculator",
      schedule: "Schedule",
      daily: "Daily Report",
      ordered: "Ordered Items"
    };
    const isActive =
      button.textContent.trim() === labels[tabName];

    button.classList.toggle("active", isActive);
  });

  if (tabName === "schedule") {
    loadSchedule();
  }

  if (tabName === "daily") {
    loadDailyReport();
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
  const logId = currentLogId;
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
      log_id: logId,
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

  const selectedItemText = getSelectedOptionText(itemSel);
  const selectedTaskText = getSelectedOptionText(taskSel);

  savedEntries.unshift({
    ...pendingEntry,
    item: selectedItemText,
    task: selectedTaskText,
    dispensaryName,
    quantity
  });
  renderSavedEntries();

  resetCompletedEntryForm();
  setTimerMessage("Entry completed and saved.");
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
  renderTaskOptions(log.item_id, log.task_id);
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
  const from = toIsoDate(addDays(weekStart, -3650));
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
    if (date.getDay() === 0 || date.getDay() === 6) {
      cell.classList.add("weekend");
    }
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", `View details for ${formatDisplayDate(isoDate)}`);

    const dateLabel = document.createElement("div");
    dateLabel.className = "schedule-date";
    dateLabel.textContent = `${dayNames[date.getDay()]} ${formatDisplayDate(isoDate)}`;
    cell.appendChild(dateLabel);

    const scheduleDay = scheduleByDate.get(isoDate) || { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] };
    const deliveries = deliveriesByDate.get(isoDate) || [];
    appendEventList(cell, scheduleDay.events || []);
    appendBatchList(cell, scheduleDay);
    appendTestPickupList(cell, scheduleDay.testPickups || []);
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

function appendDeleteDeliveryButton(card, itemId) {
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteOrderedItem(itemId));
  card.appendChild(deleteButton);
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
    appendDeleteDeliveryButton(card, item.id);
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
  appendDeleteDeliveryButton(card, item.id);

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

async function deleteOrderedItem(itemId) {
  if (!window.confirm("Delete this ordered item?")) return;

  const res = await fetch(`/ordered-items/${itemId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Delete failed: " + text);
    return;
  }

  await loadOrderedTab();
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
    closeDailyReportFocus();
    closeScheduleDayFocus();
    closeManualReceivedWindow();
  }
});

document.getElementById("dailyReportFocus").addEventListener("click", event => {
  if (event.target.id === "dailyReportFocus") {
    closeDailyReportFocus();
  }
});

document.getElementById("scheduleDayFocus").addEventListener("click", event => {
  if (event.target.id === "scheduleDayFocus") {
    closeScheduleDayFocus();
  }
});

load();
