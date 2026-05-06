let timerInterval = null;
let startTime = null;
let currentLogId = null;
let loadedItems = [];

const bulkTypes = [
  { label: "Speed Rack(20)", value: 80 },
  { label: "Sheetpan", value: 4 },
  { label: "Mold(10g)", value: 40 },
  { label: "Mold(2.4g)", value: 112 },
  { label: "Band og Bags(100)", value: 100 },
  { label: "Band of Bags(50)", value: 50 },
  { label: "Bulk Units(1unit)", value: 1 }
];

async function load() {
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
  document.getElementById("saveBtn").disabled = true;

  addCalcRow();
}

function showTab(tabName) {
  const trackerTab = document.getElementById("trackerTab");
  const calculatorTab = document.getElementById("calculatorTab");
  const buttons = document.querySelectorAll(".tab-button");

  trackerTab.classList.toggle("active", tabName === "tracker");
  calculatorTab.classList.toggle("active", tabName === "calculator");

  buttons.forEach(button => {
    const isActive =
      (tabName === "tracker" && button.textContent === "Time Entry") ||
      (tabName === "calculator" && button.textContent === "Qty Calculator");

    button.classList.toggle("active", isActive);
  });
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
  const item_id = document.getElementById("item").value;
  const task_id = document.getElementById("task").value;

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

  startTime = Date.now();

  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
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
  startTime = null;

  const qtyInput = document.getElementById("qty");
  const saveBtn = document.getElementById("saveBtn");

  qtyInput.disabled = false;
  saveBtn.disabled = false;
  qtyInput.focus();

  alert("Timer stopped. Enter quantity to finish.");
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

  currentLogId = null;
  qtyInput.value = "";
  qtyInput.disabled = true;
  saveBtn.disabled = true;
  document.getElementById("timer").innerText = "00:00:00";

  alert("Entry completed");
}

function updateTimer() {
  if (!startTime) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const formatted =
    String(hours).padStart(2, "0") + ":" +
    String(minutes).padStart(2, "0") + ":" +
    String(seconds).padStart(2, "0");

  document.getElementById("timer").innerText = formatted;
}

load();
