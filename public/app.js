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
const pendingTimerStorageKey = "productionTracker.pendingTimer";
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

function buildPendingEntry(log) {
  return {
    employee: log.employee,
    workDate: log.work_date,
    item: log.item,
    task: log.task,
    durationSeconds: Number(log.duration_seconds) || 0
  };
}

function updatePauseButton() {
  const pauseBtn = document.getElementById("pauseBtn");
  if (!pauseBtn) return;

  pauseBtn.textContent = isTimerPaused ? "Resume" : "Pause";
  pauseBtn.disabled = !currentLogId || (!startTime && !isTimerPaused);
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
    updatePauseButton();
    return;
  }

  startTime = Number(log.start_epoch) * 1000;
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  updatePauseButton();
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

function parseSchedulePayload(rawValue) {
  const empty = {
    batchHijnx: [],
    batchSb: [],
    tasks: []
  };

  if (!rawValue) return empty;

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      return {
        batchHijnx: normalizeBatchList(parsed.batchHijnx),
        batchSb: normalizeBatchList(parsed.batchSb),
        tasks: Array.isArray(parsed.tasks)
          ? parsed.tasks
              .map(task => ({
                text: String(task.text || "").trim(),
                days: Math.max(1, Number.parseInt(task.days, 10) || 1)
              }))
              .filter(task => task.text)
          : []
      };
    }

    if (Array.isArray(parsed)) {
      return {
        ...empty,
        tasks: parsed
          .map(task => ({
            text: String(task.text || "").trim(),
            days: Math.max(1, Number.parseInt(task.days, 10) || 1)
          }))
          .filter(task => task.text)
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
      .map(line => ({ text: line, days: 1 }))
  };
}

function appendTaskList(container, tasks) {
  if (!tasks.length) return;

  const list = document.createElement("ol");
  list.className = "schedule-task-list";

  tasks.forEach(task => {
    const item = document.createElement("li");
    item.textContent = task.text;
    list.appendChild(item);
  });

  container.appendChild(list);
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

function buildActiveScheduleByDate(rows, visibleStart, visibleEnd) {
  const activeSchedule = new Map();
  const rangeStart = dateOnly(visibleStart);
  const rangeEnd = dateOnly(visibleEnd);

  for (let index = 0; index <= 13; index += 1) {
    activeSchedule.set(toIsoDate(addDays(rangeStart, index)), {
      batchHijnx: [],
      batchSb: [],
      tasks: []
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
    }

    payload.tasks.forEach(task => {
      getProjectedWorkDates(startDate, task.days).forEach(activeDate => {
        if (activeDate < rangeStart || activeDate > rangeEnd) return;

        const isoDate = toIsoDate(activeDate);
        if (!activeSchedule.has(isoDate)) {
          activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], tasks: [] });
        }
        activeSchedule.get(isoDate).tasks.push({ text: task.text });
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
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Date", "Employee", "Item", "Task", "Qty", "Time"].forEach(label => {
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
      entry.task,
      entry.quantity,
      formatSeconds(entry.durationSeconds)
    ].forEach(value => {
      const td = document.createElement("td");
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

  document.getElementById("work_date").valueAsDate = new Date();
  document.getElementById("qty").disabled = true;
  document.getElementById("pauseBtn").disabled = true;
  document.getElementById("saveBtn").disabled = true;

  renderSavedEntries();
  resetOrderRequestForm();
  addCalcRow();
  await restorePendingTimer();
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

  select.addEventListener("change", updateCalculator);
  return select;
}

function addCalcRow() {
  const rows = document.getElementById("calcRows");
  const tr = document.createElement("tr");

  const bulkTypeCell = document.createElement("td");
  bulkTypeCell.appendChild(createBulkTypeSelect());

  const bulkCountCell = document.createElement("td");
  bulkCountCell.appendChild(createCalcInput("calc-bulk-count"));

  const totalCell = document.createElement("td");
  const totalInput = document.createElement("input");
  totalInput.type = "number";
  totalInput.className = "calc-row-total";
  totalInput.value = "0";
  totalInput.readOnly = true;
  totalCell.appendChild(totalInput);

  const removeCell = document.createElement("td");
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
  input.addEventListener("input", updateCalculator);
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
}

function clearCalculator() {
  document.getElementById("calcRows").innerHTML = "";
  addCalcRow();
}

function copyCalcTotalToQty() {
  const total = document.getElementById("calcGrandTotal").textContent;
  const qtyInput = document.getElementById("qty");

  qtyInput.value = total;
  showTab("tracker");

  if (!qtyInput.disabled) {
    qtyInput.focus();
  }
}

async function startTimer() {
  if (currentLogId) {
    alert("Timer already running");
    return;
  }

  const employee = document.getElementById("employee").value;
  const work_date = document.getElementById("work_date").value;
  const itemSel = document.getElementById("item");
  const taskSel = document.getElementById("task");
  const item_id = itemSel.value;
  const task_id = taskSel.value;

  if (!employee || !work_date) {
    alert("Employee and date are required");
    return;
  }

  if (!item_id || !task_id) {
    alert("Item and task are required");
    return;
  }

  const res = await fetch("/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id, task_id, employee, work_date })
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Start failed: " + text);
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
    item: itemSel.options[itemSel.selectedIndex].text,
    task: taskSel.options[taskSel.selectedIndex].text,
    durationSeconds: 0
  };
  savePendingTimer({ logId: currentLogId });

  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  updatePauseButton();
}

async function stopTimer() {
  if (!currentLogId) {
    alert("No active timer");
    return;
  }

  const res = await fetch("/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log_id: currentLogId })
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Stop failed: " + text);
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
  updatePauseButton();

  const qtyInput = document.getElementById("qty");
  const saveBtn = document.getElementById("saveBtn");

  qtyInput.disabled = false;
  saveBtn.disabled = false;
  qtyInput.focus();

  alert("Timer stopped. Enter quantity to finish.");
}

async function pauseTimer() {
  if (!currentLogId || (!startTime && !isTimerPaused)) {
    alert("No active timer");
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
    alert((isTimerPaused ? "Resume" : "Pause") + " failed: " + text);
    return;
  }

  const data = await res.json();
  applyTimerState(data);
  savePendingTimer({ logId: currentLogId });
}

async function saveQuantity() {
  const qtyInput = document.getElementById("qty");
  const saveBtn = document.getElementById("saveBtn");
  const quantity = qtyInput.value;

  if (!currentLogId) {
    alert("No active log to update");
    return;
  }

  if (!quantity) {
    alert("Enter a quantity");
    return;
  }

  const res = await fetch("/update-qty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      log_id: currentLogId,
      quantity
    })
  });

  if (!res.ok) {
    const text = await res.text();
    alert("Save failed: " + text);
    return;
  }

  savedEntries.unshift({
    ...pendingEntry,
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
  qtyInput.disabled = true;
  saveBtn.disabled = true;
  updatePauseButton();
  document.getElementById("timer").innerText = "00:00:00";

  alert("Entry completed");
}

function updateTimer() {
  if (!startTime || isTimerPaused) return;

  const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000) - pausedSeconds);

  document.getElementById("timer").innerText = formatSeconds(elapsed);
}

async function restorePendingTimer() {
  const storedTimer = loadPendingTimer();
  if (!storedTimer || !storedTimer.logId) return;

  const res = await fetch(`/timer-state/${storedTimer.logId}`);
  if (res.status === 404) {
    clearPendingTimer();
    return;
  }

  if (!res.ok) return;

  const log = await res.json();
  if (log.quantity !== null && log.quantity !== undefined) {
    clearPendingTimer();
    return;
  }

  currentLogId = log.log_id;
  pendingEntry = buildPendingEntry(log);

  selectValue("employee", log.employee);
  selectValue("work_date", log.work_date);
  selectValue("item", log.item_id);
  selectValue("task", log.task_id);

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
    updatePauseButton();
    return;
  }

  applyTimerState(log);
}

async function loadSchedule() {
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 13);
  const from = toIsoDate(addDays(weekStart, -180));
  const to = toIsoDate(weekEnd);
  const res = await fetch(`/schedule?from=${from}&to=${to}`);

  if (!res.ok) return;

  const rows = await res.json();
  const scheduleByDate = buildActiveScheduleByDate(rows, weekStart, weekEnd);
  renderScheduleCalendar(weekStart, scheduleByDate);
  renderWeeklyTasks(weekStart, scheduleByDate);
}

function renderScheduleCalendar(weekStart, scheduleByDate) {
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

    const dateLabel = document.createElement("div");
    dateLabel.className = "schedule-date";
    dateLabel.textContent = formatDisplayDate(isoDate);
    cell.appendChild(dateLabel);

    const scheduleDay = scheduleByDate.get(isoDate) || { batchHijnx: [], batchSb: [], tasks: [] };
    appendBatchList(cell, scheduleDay);

    const tasks = document.createElement("div");
    tasks.className = "schedule-tasks";
    appendTaskList(tasks, scheduleDay.tasks);
    cell.appendChild(tasks);

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

function renderOrderRequests() {
  const container = document.getElementById("orderRequests");
  container.innerHTML = "";

  if (!orderRequests.length) {
    const empty = document.createElement("div");
    empty.className = "empty-entries";
    empty.textContent = "No item requests yet.";
    container.appendChild(empty);
    return;
  }

  orderRequests.forEach(request => {
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

  if (item.received_date) {
    appendDeliveryDetail(details, "Received", item.received_date);
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

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save Received";
  saveButton.addEventListener("click", () => receiveOrderedItem(itemId, dateInput.value, locationInput.value));
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

async function receiveOrderedItem(itemId, receivedDate, receivedLocation) {
  if (!receivedDate || !receivedLocation.trim()) {
    alert("Received date and location are required");
    return;
  }

  const res = await fetch(`/ordered-items/${itemId}/receive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      received_date: receivedDate,
      received_location: receivedLocation
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

function renderDeliveryList(container, items, isReceived) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-entries";
    empty.textContent = isReceived
      ? "No received deliveries yet."
      : "No expected deliveries.";
    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    container.appendChild(createDeliveryCard(item, isReceived));
  });
}

function renderDeliveries() {
  const expected = orderedItems.filter(item => !item.received_date);
  const received = orderedItems.filter(item => item.received_date);

  renderDeliveryList(document.getElementById("expectedDeliveries"), expected, false);
  renderDeliveryList(document.getElementById("receivedDeliveries"), received, true);
}

load();
