let reportData = [];
let allEntries = [];
let allItems = [];
let allTasks = [];

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

async function initAdmin() {
  loadEmployeeSelects();
  await loadLookups();
  await loadReport();
}

initAdmin();
