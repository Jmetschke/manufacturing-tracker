<<<<<<< HEAD
let timerInterval = null;
let startTime = null;
=======
>>>>>>> ff5d2f1052c4ff9400c8704aab5a09438c5b8e69
let currentLogId = null;

async function load() {
  const items = await fetch("/items").then(r => r.json());
  const tasks = await fetch("/tasks").then(r => r.json());

  const itemSel = document.getElementById("item");
  const taskSel = document.getElementById("task");

  items.forEach(i => {
    let o = document.createElement("option");
    o.value = i.id;
    o.text = i.name;
    itemSel.appendChild(o);
  });

  tasks.forEach(t => {
    let o = document.createElement("option");
    o.value = t.id;
    o.text = t.name;
    taskSel.appendChild(o);
  });
<<<<<<< HEAD

  document.getElementById("work_date").valueAsDate = new Date();

  // ✅ UX: disable qty + save button on load
  document.getElementById("qty").disabled = true;
  document.getElementById("saveBtn").disabled = true;
}

// ✅ START TIMER
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
    headers: {"Content-Type": "application/json"},
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
}

// ✅ STOP TIMER
async function stopTimer() {
  if (!currentLogId) {
    alert("No active timer");
    return;
  }

  const res = await fetch("/stop", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
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

  // ✅ UX: enable qty + save button + focus
  const qtyInput = document.getElementById("qty");
  const saveBtn = document.getElementById("saveBtn");

  qtyInput.disabled = false;
  saveBtn.disabled = false;

  qtyInput.focus();

  alert("Timer stopped. Enter quantity to finish.");
}

// ✅ SAVE QUANTITY
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
    headers: {"Content-Type": "application/json"},
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

  // ✅ reset state
  currentLogId = null;
  qtyInput.value = "";
  qtyInput.disabled = true;
  saveBtn.disabled = true;

  alert("Entry completed");
}

// ✅ TIMER DISPLAY
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
=======
}

async function startTimer() {
  const item_id = document.getElementById("item").value;
  const task_id = document.getElementById("task").value;

  const res = await fetch("/start", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ item_id, task_id })
  });

  const data = await res.json();
  currentLogId = data.log_id;
}

async function stopTimer() {
  const quantity = document.getElementById("qty").value;

  await fetch("/stop", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ log_id: currentLogId, quantity })
  });

  alert("Saved");
>>>>>>> ff5d2f1052c4ff9400c8704aab5a09438c5b8e69
}

load();