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
}

load();