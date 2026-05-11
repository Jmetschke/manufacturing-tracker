let reportData = [];
let allEntries = [];
let allItems = [];
let allTasks = [];
let adminScheduleRows = new Map();
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hijnxBatchOptions = [
  "Alpha OG 1pks",
  "Alpha OG 2pks",
  "Rex OG 1pks",
  "Rex OG 2pks",
  "Zuul OG 1pks",
  "Zuul OG 2pks",
  "Sleep 1pks",
  "Sleep 2pks",
  "Chill 1pks",
  "Chill 2pks",
  "Mini 10pks",
  "SF mini 10pks",
  "SF 2pks",
  "Medley - Rex",
  "Medley - Zuul",
  "Medley - Alpha",
  "Whoopies",
  "Dots",
  "AM Tincs",
  "PM Tincs",
  "Shooters - TC",
  "Shooters - SW",
  "Shooters - SBR"
];
const sbBatchOptions = [
  "Grape 1G",
  "Mango 1G",
  "Lemon 1G",
  "Watermelon 1G",
  "Strawberry 2G",
  "Peach 2G",
  "Cherry 2G"
];

function showMessage(text, type = "") {
  const message = document.getElementById("message");
  message.textContent = text;
  message.className = type ? `message ${type}` : "message";
}

function fillSelect(select, options, placeholder = "") {
  select.innerHTML = "";

  if (placeholder) {
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.text = placeholder;
    select.appendChild(placeholderOption);
  }

  options.forEach(optionData => {
    const option = document.createElement("option");
    option.value = String(optionData.value);
    option.text = optionData.text;
    select.appendChild(option);
  });
}

async function loadLookups() {
  const [items, tasks] = await Promise.all([
    fetch("/items").then(r => r.json()),
    fetch("/tasks").then(r => r.json())
  ]);

  allItems = items;
  allTasks = tasks;

  fillSelect(
    document.getElementById("item_filter"),
    allItems.map(item => ({ value: item.name, text: item.name })),
    "All Items"
  );

  fillSelect(
    document.getElementById("edit_item"),
    allItems.map(item => ({ value: item.id, text: item.name }))
  );

  fillSelect(
    document.getElementById("edit_task"),
    allTasks.map(task => ({ value: task.id, text: task.name }))
  );
}

function loadEmployeeSelects() {
  const employees = window.employeeNames.map(employee => ({
    value: employee,
    text: employee
  }));

  fillSelect(document.getElementById("employee_filter"), employees, "All Employees");
  fillSelect(document.getElementById("edit_employee"), employees);
}

function secondsToHMS(sec) {
  const totalSeconds = Number(sec) || 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseHMSToSeconds(value) {
  if (!value.trim()) return null;

  const parts = value.trim().split(":").map(part => part.trim());
  if (parts.some(part => !/^\d+$/.test(part))) return null;

  if (parts.length === 1) {
    const seconds = Number(parts[0]);
    return Number.isFinite(seconds) ? seconds : null;
  }

  if (parts.length !== 2 && parts.length !== 3) return null;

  const numbers = parts.map(part => Number(part));
  if (numbers.some(number => !Number.isInteger(number) || number < 0)) return null;

  const [hours, minutes, seconds] =
    parts.length === 2 ? [0, numbers[0], numbers[1]] : numbers;

  if (minutes >= 60 || seconds >= 60) return null;
  return Math.floor((hours * 3600) + (minutes * 60) + seconds);
}

function csvValue(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekendIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0 || date.getDay() === 6;
}

function monthStart(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthGridStart(date) {
  return addDays(date, -date.getDay());
}

function formatDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
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

function getScheduleTasks(rawValue) {
  return parseSchedulePayload(rawValue).tasks;
}

function appendBatchList(container, payload) {
  const batches = [
    ...payload.batchHijnx.map(batch => ["Production Batch - Hijnx", batch]),
    ...payload.batchSb.map(batch => ["Production Batch - SB", batch])
  ];

  if (!batches.length) return;

  const batchList = document.createElement("div");
  batchList.className = "admin-batch-list";

  batches.forEach(([label, batch]) => {
    const item = document.createElement("div");
    item.className = "admin-batch-item";
    item.textContent = batch.units
      ? `${label}: ${batch.item} - ${batch.units} units`
      : `${label}: ${batch.item}`;
    batchList.appendChild(item);
  });

  container.appendChild(batchList);
}

function getBatchRows(type) {
  return document.getElementById(type === "hijnx" ? "batchHijnxRows" : "batchSbRows");
}

function refreshBatchRows(type) {
  getBatchRows(type).querySelectorAll(".batch-row").forEach((row, index) => {
    row.querySelector(".batch-order").textContent = `${index + 1}.`;
  });
}

function addBatchEntry(type, value = "", unitsValue = "") {
  const rows = getBatchRows(type);
  const row = document.createElement("div");
  row.className = "batch-row";

  const batchValue = value && typeof value === "object" ? value.item : value;
  const batchUnits = value && typeof value === "object" ? value.units : unitsValue;

  const order = document.createElement("span");
  order.className = "batch-order";
  row.appendChild(order);

  const input = document.createElement("select");
  input.className = "batch-input";

  const options = type === "hijnx" ? hijnxBatchOptions : sbBatchOptions;
  const blankOption = document.createElement("option");
  blankOption.value = "";
  blankOption.text = type === "hijnx" ? "Select Hijnx batch" : "Select SB batch";
  input.appendChild(blankOption);

  options.forEach(optionValue => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.text = optionValue;
    input.appendChild(option);
  });

  if (batchValue && !options.includes(batchValue)) {
    const existingOption = document.createElement("option");
    existingOption.value = batchValue;
    existingOption.text = batchValue;
    input.appendChild(existingOption);
  }

  input.value = batchValue;
  row.appendChild(input);

  const units = document.createElement("input");
  units.type = "number";
  units.className = "batch-units";
  units.min = "0";
  units.step = "1";
  units.placeholder = "Units";
  units.value = batchUnits;
  row.appendChild(units);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!rows.children.length) {
      addBatchEntry(type);
      return;
    }
    refreshBatchRows(type);
  });
  row.appendChild(removeButton);

  rows.appendChild(row);
  refreshBatchRows(type);
  return input;
}

function populateBatchRows(type, values) {
  const rows = getBatchRows(type);
  rows.innerHTML = "";

  if (!values.length) {
    addBatchEntry(type);
    return;
  }

  values.forEach(value => addBatchEntry(type, value));
}

function getBatchValues(type) {
  return Array.from(getBatchRows(type).querySelectorAll(".batch-row"))
    .map(row => ({
      item: row.querySelector(".batch-input").value.trim(),
      units: row.querySelector(".batch-units").value.trim()
    }))
    .filter(batch => batch.item);
}

function appendOrderedTaskList(container, tasks, className) {
  const lines = getScheduleTasks(tasks);
  if (!lines.length) return;

  const list = document.createElement("ol");
  list.className = className;

  lines.forEach(task => {
    const item = document.createElement("li");
    item.textContent = task.days > 1 ? `${task.text} (${task.days} days)` : task.text;
    list.appendChild(item);
  });

  container.appendChild(list);
}

function showAdminTab(tabName) {
  document.getElementById("entriesPanel").classList.toggle("active", tabName === "entries");
  document.getElementById("calendarPanel").classList.toggle("active", tabName === "calendar");

  document.querySelectorAll(".admin-tab-button").forEach(button => {
    const isActive =
      (tabName === "entries" && button.textContent === "Entries") ||
      (tabName === "calendar" && button.textContent === "Calendar");
    button.classList.toggle("active", isActive);
  });

  showMessage("");

  if (tabName === "calendar") {
    loadAdminCalendar();
  }
}

async function loadReport() {
  const data = await fetch("/admin/entries").then(r => r.json());

  const from = document.getElementById("from_date").value;
  const to = document.getElementById("to_date").value;
  const emp = document.getElementById("employee_filter").value;
  const item = document.getElementById("item_filter").value;

  allEntries = data;
  reportData = data.filter(entry => {
    if (from && entry.work_date < from) return false;
    if (to && entry.work_date > to) return false;
    if (emp && entry.employee !== emp) return false;
    if (item && entry.item !== item) return false;
    return true;
  });

  renderTable();
  renderSummary();
}

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
}

function renderTable() {
  const container = document.getElementById("table");
  container.innerHTML = "";

  const table = document.createElement("table");
  const headerRow = document.createElement("tr");

  ["Date", "Employee", "Item", "Task", "Qty", "Time", "Sec/Unit", ""].forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  reportData.forEach(entry => {
    const row = document.createElement("tr");
    appendCell(row, entry.work_date);
    appendCell(row, entry.employee);
    appendCell(row, entry.item);
    appendCell(row, entry.task);
    appendCell(row, entry.quantity || 0);
    appendCell(row, secondsToHMS(entry.duration_seconds));
    appendCell(row, Math.round(entry.sec_per_unit || 0));

    const actionCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editEntry(entry.log_id));
    actionCell.appendChild(editButton);
    row.appendChild(actionCell);

    table.appendChild(row);
  });

  container.appendChild(table);
}

function renderSummary() {
  let totalQty = 0;
  let totalTime = 0;

  reportData.forEach(entry => {
    totalQty += entry.quantity || 0;
    totalTime += entry.duration_seconds || 0;
  });

  const avg = totalQty ? Math.round(totalTime / totalQty) : 0;

  document.getElementById("summary").innerHTML = `
    <b>Total Qty:</b> ${totalQty} |
    <b>Total Time:</b> ${secondsToHMS(totalTime)} |
    <b>Avg Sec/Unit:</b> ${avg}
  `;
}

function editEntry(logId) {
  const entry = allEntries.find(item => item.log_id === logId);
  if (!entry) return;

  document.getElementById("edit_log_id").value = entry.log_id;
  document.getElementById("edit_work_date").value = entry.work_date;
  document.getElementById("edit_employee").value = entry.employee;
  document.getElementById("edit_item").value = String(entry.item_id);
  document.getElementById("edit_task").value = String(entry.task_id);
  document.getElementById("edit_quantity").value = entry.quantity || 0;
  document.getElementById("edit_time").value = secondsToHMS(entry.duration_seconds);
  document.getElementById("editPanel").classList.add("active");
  showMessage("");
  document.getElementById("edit_quantity").focus();
}

function cancelEntryEdit() {
  document.getElementById("editPanel").classList.remove("active");
  document.getElementById("edit_log_id").value = "";
  showMessage("");
}

async function saveEntryEdit() {
  const logId = document.getElementById("edit_log_id").value;
  const durationSeconds = parseHMSToSeconds(document.getElementById("edit_time").value);

  if (!logId) return;

  if (durationSeconds === null) {
    showMessage("Enter time as HH:MM:SS, MM:SS, or total seconds.", "error");
    return;
  }

  const payload = {
    work_date: document.getElementById("edit_work_date").value,
    employee: document.getElementById("edit_employee").value,
    item_id: document.getElementById("edit_item").value,
    task_id: document.getElementById("edit_task").value,
    quantity: document.getElementById("edit_quantity").value,
    duration_seconds: durationSeconds
  };

  const res = await fetch(`/admin/entries/${logId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Save failed: " + text, "error");
    return;
  }

  cancelEntryEdit();
  showMessage("Entry updated.", "success");
  await loadReport();
}

function exportCSV() {
  if (!reportData.length) return;

  let csv = "Date,Employee,Item,Task,Qty,Total Time,Sec/Unit\n";

  reportData.forEach(entry => {
    csv += [
      entry.work_date,
      entry.employee,
      entry.item,
      entry.task,
      entry.quantity,
      entry.duration_seconds,
      Math.round(entry.sec_per_unit || 0)
    ].map(csvValue).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function setDefaultCalendarMonth() {
  document.getElementById("calendar_month").value = toMonthValue(new Date());
}

function changeAdminCalendarMonth(offset) {
  const monthInput = document.getElementById("calendar_month");
  const current = monthStart(monthInput.value || toMonthValue(new Date()));
  current.setMonth(current.getMonth() + offset);
  monthInput.value = toMonthValue(current);
  loadAdminCalendar();
}

async function loadAdminCalendar() {
  const monthInput = document.getElementById("calendar_month");
  if (!monthInput.value) {
    setDefaultCalendarMonth();
  }

  const firstDay = monthStart(monthInput.value);
  const gridStart = monthGridStart(firstDay);
  const gridEnd = addDays(gridStart, 41);
  const from = toIsoDate(gridStart);
  const to = toIsoDate(gridEnd);
  const res = await fetch(`/schedule?from=${from}&to=${to}`);

  if (!res.ok) {
    showMessage("Could not load calendar.", "error");
    return;
  }

  const rows = await res.json();
  adminScheduleRows = new Map(rows.map(row => [row.schedule_date, row.tasks || ""]));
  renderAdminCalendar(firstDay, gridStart);
}

function renderAdminCalendar(firstDay, gridStart) {
  const calendar = document.getElementById("adminCalendar");
  calendar.innerHTML = "";

  dayNames.forEach(dayName => {
    const header = document.createElement("div");
    header.className = "admin-day-name";
    header.textContent = dayName;
    calendar.appendChild(header);
  });

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const isoDate = toIsoDate(date);
    const cell = document.createElement("div");
    cell.className = "admin-calendar-day";
    if (date.getMonth() !== firstDay.getMonth()) {
      cell.classList.add("outside-month");
    }

    const dateLabel = document.createElement("div");
    dateLabel.className = "admin-calendar-date";
    dateLabel.textContent = date.getDate();
    cell.appendChild(dateLabel);

    const payload = parseSchedulePayload(adminScheduleRows.get(isoDate));
    appendBatchList(cell, payload);

    const tasks = document.createElement("div");
    tasks.className = "admin-calendar-tasks";
    appendOrderedTaskList(tasks, adminScheduleRows.get(isoDate), "admin-task-list");
    cell.appendChild(tasks);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editScheduleDay(isoDate));
    cell.appendChild(editButton);

    calendar.appendChild(cell);
  }
}

function refreshScheduleTaskRows() {
  document.querySelectorAll(".schedule-task-row").forEach((row, index, rows) => {
    row.querySelector(".schedule-task-order").textContent = `${index + 1}.`;
    row.querySelector(".schedule-task-up").disabled = index === 0;
    row.querySelector(".schedule-task-down").disabled = index === rows.length - 1;
  });
}

function addScheduleTask(value = "", daysValue = 1) {
  const rows = document.getElementById("scheduleTaskRows");
  const row = document.createElement("div");
  row.className = "schedule-task-row";

  const order = document.createElement("span");
  order.className = "schedule-task-order";
  row.appendChild(order);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "schedule-task-input";
  input.value = value;
  input.placeholder = "Task";
  row.appendChild(input);

  const days = document.createElement("input");
  days.type = "number";
  days.className = "schedule-task-days";
  days.min = "1";
  days.step = "1";
  days.value = String(Math.max(1, Number.parseInt(daysValue, 10) || 1));
  days.title = "Days";
  row.appendChild(days);

  const upButton = document.createElement("button");
  upButton.type = "button";
  upButton.className = "schedule-task-up";
  upButton.textContent = "Up";
  upButton.addEventListener("click", () => {
    if (row.previousElementSibling) {
      rows.insertBefore(row, row.previousElementSibling);
      refreshScheduleTaskRows();
    }
  });
  row.appendChild(upButton);

  const downButton = document.createElement("button");
  downButton.type = "button";
  downButton.className = "schedule-task-down";
  downButton.textContent = "Down";
  downButton.addEventListener("click", () => {
    if (row.nextElementSibling) {
      rows.insertBefore(row.nextElementSibling, row);
      refreshScheduleTaskRows();
    }
  });
  row.appendChild(downButton);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!rows.children.length) {
      addScheduleTask();
      return;
    }
    refreshScheduleTaskRows();
  });
  row.appendChild(removeButton);

  rows.appendChild(row);
  refreshScheduleTaskRows();
  return input;
}

function populateScheduleTaskRows(tasks) {
  const rows = document.getElementById("scheduleTaskRows");
  rows.innerHTML = "";

  const lines = getScheduleTasks(tasks);
  if (!lines.length) {
    addScheduleTask();
    return;
  }

  lines.forEach(task => addScheduleTask(task.text, task.days));
}

function buildSchedulePayload(includeTasks = true) {
  const tasks = includeTasks
    ? Array.from(document.querySelectorAll(".schedule-task-row"))
        .map(row => ({
          text: row.querySelector(".schedule-task-input").value.trim(),
          days: Math.max(1, Number.parseInt(row.querySelector(".schedule-task-days").value, 10) || 1)
        }))
        .filter(task => task.text)
    : [];

  return JSON.stringify({
    batchHijnx: getBatchValues("hijnx"),
    batchSb: getBatchValues("sb"),
    tasks
  });
}

function editScheduleDay(isoDate) {
  const payload = parseSchedulePayload(adminScheduleRows.get(isoDate));
  const isWeekendDay = isWeekendIsoDate(isoDate);
  const taskSection = document.querySelector(".schedule-task-section");

  document.getElementById("schedule_edit_date").value = isoDate;
  document.getElementById("scheduleEditLabel").textContent = formatDisplayDate(isoDate);
  populateBatchRows("hijnx", payload.batchHijnx);
  populateBatchRows("sb", payload.batchSb);
  taskSection.hidden = isWeekendDay;
  populateScheduleTaskRows(isWeekendDay ? "" : adminScheduleRows.get(isoDate) || "");
  document.getElementById("scheduleEditor").classList.add("active");
  showMessage("");
  getBatchRows("hijnx").querySelector(".batch-input").focus();
}

function cancelScheduleEdit() {
  document.getElementById("scheduleEditor").classList.remove("active");
  document.getElementById("schedule_edit_date").value = "";
  getBatchRows("hijnx").innerHTML = "";
  getBatchRows("sb").innerHTML = "";
  document.getElementById("scheduleTaskRows").innerHTML = "";
  document.querySelector(".schedule-task-section").hidden = false;
}

async function saveScheduleDay() {
  const scheduleDate = document.getElementById("schedule_edit_date").value;
  const tasks = buildSchedulePayload(!isWeekendIsoDate(scheduleDate));

  if (!scheduleDate) return;

  const res = await fetch(`/admin/schedule/${scheduleDate}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks })
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Schedule save failed: " + text, "error");
    return;
  }

  cancelScheduleEdit();
  showMessage("Calendar day updated.", "success");
  await loadAdminCalendar();
}

async function initAdmin() {
  loadEmployeeSelects();
  await loadLookups();
  setDefaultCalendarMonth();
  await loadReport();
}

initAdmin();
