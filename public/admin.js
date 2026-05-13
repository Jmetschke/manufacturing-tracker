let reportData = [];
let allEntries = [];
let allItems = [];
let allTasks = [];
let allOrderedItems = [];
let allOrderRequests = [];
let adminScheduleRows = new Map();
let adminExpectedDeliveriesByDate = new Map();
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
        tasks: Array.isArray(parsed.tasks)
          ? parsed.tasks
              .map(task => ({
                text: String(task.text || "").trim(),
                days: Math.max(1, Number.parseInt(task.days, 10) || 1)
              }))
              .filter(task => task.text)
          : [],
        testPickups: normalizeTestPickups(parsed.testPickups)
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
      .map(line => ({ text: line, days: 1 })),
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

function appendTestPickupList(container, payload) {
  if (!payload.testPickups.length) return;

  const pickupList = document.createElement("div");
  pickupList.className = "admin-test-pickup-list";

  payload.testPickups.forEach(pickup => {
    const item = document.createElement("div");
    item.className = "admin-test-pickup";
    item.textContent = `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`;
    pickupList.appendChild(item);
  });

  container.appendChild(pickupList);
}

function buildAdminExpectedDeliveriesByDate(items, visibleStart, visibleEnd) {
  const deliveriesByDate = new Map();
  const rangeStartIso = toIsoDate(visibleStart);
  const rangeEndIso = toIsoDate(visibleEnd);

  items.forEach(item => {
    const expectedDate = item.expected_delivery_date;
    if (!expectedDate || item.received_date) return;
    if (expectedDate < rangeStartIso || expectedDate > rangeEndIso) return;

    if (!deliveriesByDate.has(expectedDate)) {
      deliveriesByDate.set(expectedDate, []);
    }

    deliveriesByDate.get(expectedDate).push(item);
  });

  return deliveriesByDate;
}

function appendAdminExpectedDeliveries(container, deliveries) {
  if (!deliveries.length) return;

  const section = document.createElement("div");
  section.className = "admin-calendar-deliveries";

  const heading = document.createElement("div");
  heading.className = "admin-calendar-delivery-heading";
  heading.textContent = "Expected Deliveries";
  section.appendChild(heading);

  deliveries.forEach(delivery => {
    const item = document.createElement("div");
    item.className = "admin-calendar-delivery";
    item.textContent = `${delivery.item_name} - QTY ${delivery.package_qty}`;
    section.appendChild(item);
  });

  container.appendChild(section);
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
  document.getElementById("orderedPanel").classList.toggle("active", tabName === "ordered");

  document.querySelectorAll(".admin-tab-button").forEach(button => {
    const isActive =
      (tabName === "entries" && button.textContent === "Entries") ||
      (tabName === "calendar" && button.textContent === "Calendar") ||
      (tabName === "ordered" && button.textContent === "Ordered Items");
    button.classList.toggle("active", isActive);
  });

  showMessage("");

  if (tabName === "calendar") {
    loadAdminCalendar();
  }

  if (tabName === "ordered") {
    loadOrderedAdminData();
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

function appendCell(row, value, label = "") {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;
  row.appendChild(cell);
}

function renderTable() {
  const container = document.getElementById("table");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";

  const labels = ["Date", "Employee", "Item", "Task", "Qty", "Time", "Sec/Unit", "Action"];
  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label === "Action" ? "" : label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  reportData.forEach(entry => {
    const row = document.createElement("tr");
    appendCell(row, entry.work_date, labels[0]);
    appendCell(row, entry.employee, labels[1]);
    appendCell(row, entry.item, labels[2]);
    appendCell(row, entry.task, labels[3]);
    appendCell(row, entry.quantity || 0, labels[4]);
    appendCell(row, secondsToHMS(entry.duration_seconds), labels[5]);
    appendCell(row, Math.round(entry.sec_per_unit || 0), labels[6]);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[7];
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
    <div class="summary-line">
      <span><b>Total Qty:</b> ${totalQty}</span>
      <span><b>Total Time:</b> ${secondsToHMS(totalTime)}</span>
      <span><b>Avg Sec/Unit:</b> ${avg}</span>
    </div>
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
  const [scheduleRes, orderedRes] = await Promise.all([
    fetch(`/schedule?from=${from}&to=${to}`),
    fetch("/ordered-items")
  ]);

  if (!scheduleRes.ok) {
    showMessage("Could not load calendar.", "error");
    return;
  }

  const rows = await scheduleRes.json();
  const deliveries = orderedRes.ok ? await orderedRes.json() : [];
  adminScheduleRows = new Map(rows.map(row => [row.schedule_date, row.tasks || ""]));
  adminExpectedDeliveriesByDate = buildAdminExpectedDeliveriesByDate(deliveries, gridStart, gridEnd);
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
    appendAdminExpectedDeliveries(cell, adminExpectedDeliveriesByDate.get(isoDate) || []);
    appendTestPickupList(cell, payload);

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

function refreshTestPickupRows() {
  document.querySelectorAll(".test-pickup-row").forEach((row, index) => {
    row.querySelector(".schedule-task-order").textContent = `${index + 1}.`;
  });
}

function addTestPickup(value = { time: "", items: [] }) {
  const rows = document.getElementById("testPickupRows");
  const row = document.createElement("div");
  row.className = "test-pickup-row";

  const order = document.createElement("span");
  order.className = "schedule-task-order";
  row.appendChild(order);

  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.className = "test-pickup-time";
  timeInput.placeholder = "00:00";
  timeInput.inputMode = "numeric";
  timeInput.maxLength = 5;
  timeInput.pattern = "([01]\\d|2[0-3]):[0-5]\\d";
  timeInput.title = "Enter time as HH:MM";
  timeInput.value = value.time || "";
  timeInput.addEventListener("input", () => {
    timeInput.value = timeInput.value
      .replace(/[^\d:]/g, "")
      .replace(/^(\d{2})(\d)/, "$1:$2")
      .slice(0, 5);
  });
  row.appendChild(timeInput);

  const itemSelect = document.createElement("select");
  itemSelect.className = "test-pickup-items";
  itemSelect.multiple = true;
  allTasks.forEach(task => {
    const option = document.createElement("option");
    option.value = task.name;
    option.text = task.name;
    option.selected = Array.isArray(value.items) && value.items.includes(task.name);
    itemSelect.appendChild(option);
  });
  row.appendChild(itemSelect);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    refreshTestPickupRows();
  });
  row.appendChild(removeButton);

  rows.appendChild(row);
  refreshTestPickupRows();
  return timeInput;
}

function populateTestPickupRows(testPickups) {
  const rows = document.getElementById("testPickupRows");
  rows.innerHTML = "";
  testPickups.forEach(pickup => addTestPickup(pickup));
}

function getTestPickupValues() {
  return Array.from(document.querySelectorAll(".test-pickup-row"))
    .map(row => ({
      time: row.querySelector(".test-pickup-time").value.trim(),
      items: Array.from(row.querySelector(".test-pickup-items").selectedOptions)
        .map(option => option.value)
        .filter(Boolean)
    }))
    .filter(pickup => pickup.time || pickup.items.length);
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

  const testPickups = includeTasks ? getTestPickupValues() : [];
  const invalidPickup = testPickups.find(pickup => !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickup.time) || !pickup.items.length);
  if (invalidPickup) {
    throw new Error("Each Test Pick Up needs a valid HH:MM time and at least one selected item.");
  }

  return JSON.stringify({
    batchHijnx: getBatchValues("hijnx"),
    batchSb: getBatchValues("sb"),
    tasks,
    testPickups
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
  populateTestPickupRows(isWeekendDay ? [] : payload.testPickups);
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
  document.getElementById("testPickupRows").innerHTML = "";
  document.querySelector(".schedule-task-section").hidden = false;
}

async function saveScheduleDay() {
  const scheduleDate = document.getElementById("schedule_edit_date").value;
  let tasks;

  try {
    tasks = buildSchedulePayload(!isWeekendIsoDate(scheduleDate));
  } catch (err) {
    showMessage(err.message, "error");
    return;
  }

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

function resetOrderedForm() {
  document.getElementById("ordered_date_ordered").value = toIsoDate(new Date());
  document.getElementById("ordered_expected_delivery_date").value = "";
  document.getElementById("ordered_item_name").value = "";
  document.getElementById("ordered_package_qty").value = "";
  document.getElementById("ordered_item_supplier").value = "";
  document.getElementById("ordered_department").value = "";
}

function resetAdminOrderRequestForm() {
  document.getElementById("admin_request_date").value = toIsoDate(new Date());
  document.getElementById("admin_requester_name").value = "";
  document.getElementById("admin_request_department").value = "";
  document.getElementById("admin_request_item_needed").value = "";
  document.getElementById("admin_request_qty_needed").value = "";
  document.getElementById("admin_request_suggested_retailer").value = "";
}

async function loadOrderedItems() {
  const res = await fetch("/ordered-items");

  if (!res.ok) {
    showMessage("Could not load ordered items.", "error");
    return;
  }

  allOrderedItems = await res.json();
  renderOrderedItemsTable();
}

async function loadOrderRequests() {
  const res = await fetch("/order-requests");

  if (!res.ok) {
    showMessage("Could not load item requests.", "error");
    return;
  }

  allOrderRequests = await res.json();
  renderAdminOrderRequests();
}

async function loadOrderedAdminData() {
  await Promise.all([
    loadOrderRequests(),
    loadOrderedItems()
  ]);
}

async function saveAdminOrderRequest() {
  const payload = {
    request_date: document.getElementById("admin_request_date").value,
    requester_name: document.getElementById("admin_requester_name").value,
    department: document.getElementById("admin_request_department").value,
    item_needed: document.getElementById("admin_request_item_needed").value,
    qty_needed: document.getElementById("admin_request_qty_needed").value,
    suggested_retailer: document.getElementById("admin_request_suggested_retailer").value
  };

  const res = await fetch("/order-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Request save failed: " + text, "error");
    return;
  }

  resetAdminOrderRequestForm();
  showMessage("Item request submitted.", "success");
  await loadOrderRequests();
}

function renderAdminOrderRequests() {
  const container = document.getElementById("adminOrderRequests");
  container.innerHTML = "";

  if (!allOrderRequests.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "No item requests yet.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";
  const labels = [
    "Date",
    "Name",
    "Department",
    "Item Needed",
    "QTY Needed",
    "Suggested Retailer",
    "Status",
    "Ordered"
  ];
  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  allOrderRequests.forEach(request => {
    const row = document.createElement("tr");
    appendCell(row, request.request_date, labels[0]);
    appendCell(row, request.requester_name, labels[1]);
    appendCell(row, request.department || "", labels[2]);
    appendCell(row, request.item_needed, labels[3]);
    appendCell(row, request.qty_needed, labels[4]);
    appendCell(row, request.suggested_retailer || "", labels[5]);
    appendCell(row, request.status, labels[6]);

    const orderedCell = document.createElement("td");
    orderedCell.dataset.label = labels[7];
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(request.ordered_item_id);
    checkbox.disabled = Boolean(request.ordered_item_id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        showRequestOrderForm(request, orderedCell, checkbox);
      }
    });
    orderedCell.appendChild(checkbox);
    row.appendChild(orderedCell);

    table.appendChild(row);
  });

  container.appendChild(table);
}

function createOrderField(labelText, input) {
  const field = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = labelText;
  field.appendChild(label);
  field.appendChild(input);
  return field;
}

function showRequestOrderForm(request, cell, checkbox) {
  const existingForm = cell.querySelector(".request-order-form");
  if (existingForm) {
    existingForm.classList.add("active");
    return;
  }

  const form = document.createElement("div");
  form.className = "request-order-form active";

  const dateOrdered = document.createElement("input");
  dateOrdered.type = "date";
  dateOrdered.value = toIsoDate(new Date());
  form.appendChild(createOrderField("Date Ordered", dateOrdered));

  const packageQty = document.createElement("input");
  packageQty.type = "number";
  packageQty.min = "1";
  packageQty.step = "1";
  packageQty.value = request.qty_needed || "";
  form.appendChild(createOrderField("Unit-package QTY Ordered", packageQty));

  const unitsPerPackage = document.createElement("input");
  unitsPerPackage.type = "number";
  unitsPerPackage.min = "0";
  unitsPerPackage.step = "1";
  form.appendChild(createOrderField("Units Per Package", unitsPerPackage));

  const retailer = document.createElement("input");
  retailer.type = "text";
  retailer.value = request.suggested_retailer || "";
  form.appendChild(createOrderField("Retailer", retailer));

  const expectedDelivery = document.createElement("input");
  expectedDelivery.type = "date";
  form.appendChild(createOrderField("Expected Delivery", expectedDelivery));

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save Ordered";
  saveButton.addEventListener("click", () => markRequestOrdered(request.id, {
    date_ordered: dateOrdered.value,
    package_qty: packageQty.value,
    units_per_package: unitsPerPackage.value,
    retailer: retailer.value,
    expected_delivery_date: expectedDelivery.value
  }));
  form.appendChild(saveButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    checkbox.checked = false;
    form.remove();
  });
  form.appendChild(cancelButton);

  cell.appendChild(form);
  expectedDelivery.focus();
}

async function markRequestOrdered(requestId, payload) {
  const res = await fetch(`/admin/order-requests/${requestId}/order`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Could not mark request ordered: " + text, "error");
    return;
  }

  showMessage("Item request marked ordered and added to expected deliveries.", "success");
  await loadOrderedAdminData();
}

function renderOrderedItemsTable() {
  renderExpectedDeliveriesTable();
  renderReceivedDeliveriesTable();
}

function appendDeliveryRowCells(row, item, labels, includeReceivedDetails = false) {
  const values = [
    item.date_ordered,
    item.expected_delivery_date,
    item.item_name,
    item.item_company,
    item.package_qty,
    item.units_per_package || "",
    item.item_supplier,
    item.department,
    item.requested_by || ""
  ];

  values.forEach((value, index) => appendCell(row, value, labels[index]));

  if (includeReceivedDetails) {
    appendCell(row, item.received_date || "", labels[values.length]);
    appendCell(row, item.received_location || "", labels[values.length + 1]);
  }
}

function appendDeliveryHeader(table, extraLabels = []) {
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";
  const labels = [
    "Date Ordered",
    "Expected Delivery",
    "Item Name",
    "Item Company",
    "Package QTY",
    "Units/Package",
    "Supplier",
    "Department",
    "Requested By",
    ...extraLabels
  ];

  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  return labels;
}

function renderExpectedDeliveriesTable() {
  const container = document.getElementById("adminExpectedDeliveries");
  container.innerHTML = "";
  const expectedDeliveries = allOrderedItems.filter(item => !item.received_date);

  if (!expectedDeliveries.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "No expected deliveries.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const labels = appendDeliveryHeader(table, ["Received"]);

  expectedDeliveries.forEach(item => {
    const row = document.createElement("tr");
    appendDeliveryRowCells(row, item, labels);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[labels.length - 1];
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        showAdminReceiveForm(item.id, actionCell, checkbox);
      }
    });
    actionCell.appendChild(checkbox);
    row.appendChild(actionCell);

    table.appendChild(row);
  });

  container.appendChild(table);
}

function showAdminReceiveForm(itemId, cell, checkbox) {
  const existingForm = cell.querySelector(".request-order-form");
  if (existingForm) {
    existingForm.classList.add("active");
    return;
  }

  const form = document.createElement("div");
  form.className = "request-order-form active";

  const receivedDate = document.createElement("input");
  receivedDate.type = "date";
  receivedDate.value = toIsoDate(new Date());
  form.appendChild(createOrderField("Received Date", receivedDate));

  const location = document.createElement("input");
  location.type = "text";
  form.appendChild(createOrderField("Location", location));

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save Received";
  saveButton.addEventListener("click", () => saveAdminReceivedItem(itemId, {
    received_date: receivedDate.value,
    received_location: location.value
  }));
  form.appendChild(saveButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    checkbox.checked = false;
    form.remove();
  });
  form.appendChild(cancelButton);

  cell.appendChild(form);
  location.focus();
}

async function saveAdminReceivedItem(itemId, payload) {
  const res = await fetch(`/ordered-items/${itemId}/receive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Could not mark delivery received: " + text, "error");
    return;
  }

  showMessage("Delivery marked received.", "success");
  await loadOrderedItems();
}

function renderReceivedDeliveriesTable() {
  const container = document.getElementById("adminReceivedDeliveries");
  container.innerHTML = "";
  const receivedDeliveries = allOrderedItems.filter(item => item.received_date);

  if (!receivedDeliveries.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "No received deliveries yet.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const labels = appendDeliveryHeader(table, ["Received Date", "Location", "Action"]);

  receivedDeliveries.forEach(item => {
    const row = document.createElement("tr");
    appendDeliveryRowCells(row, item, labels, true);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[labels.length - 1];
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.textContent = "Undo";
    undoButton.addEventListener("click", () => undoAdminReceivedItem(item.id));
    actionCell.appendChild(undoButton);
    row.appendChild(actionCell);

    table.appendChild(row);
  });

  container.appendChild(table);
}

async function undoAdminReceivedItem(itemId) {
  const res = await fetch(`/ordered-items/${itemId}/undo-receive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Could not undo received delivery: " + text, "error");
    return;
  }

  showMessage("Delivery moved back to expected deliveries.", "success");
  await loadOrderedItems();
}

async function saveOrderedItem() {
  const payload = {
    date_ordered: document.getElementById("ordered_date_ordered").value,
    expected_delivery_date: document.getElementById("ordered_expected_delivery_date").value,
    item_name: document.getElementById("ordered_item_name").value,
    package_qty: document.getElementById("ordered_package_qty").value,
    item_supplier: document.getElementById("ordered_item_supplier").value,
    department: document.getElementById("ordered_department").value
  };

  const res = await fetch("/admin/ordered-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Ordered item save failed: " + text, "error");
    return;
  }

  resetOrderedForm();
  showMessage("Ordered item added.", "success");
  await loadOrderedItems();
}

async function initAdmin() {
  loadEmployeeSelects();
  await loadLookups();
  setDefaultCalendarMonth();
  resetOrderedForm();
  resetAdminOrderRequestForm();
  await loadReport();
}

initAdmin();
