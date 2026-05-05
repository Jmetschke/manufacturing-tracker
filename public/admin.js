let reportData = [];

function secondsToHMS(sec) {
  if (!sec) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

async function loadReport() {
  const data = await fetch("/report").then(r => r.json());

  const from = document.getElementById("from_date").value;
  const to = document.getElementById("to_date").value;
  const emp = document.getElementById("employee_filter").value.toLowerCase();

  // Filter
  reportData = data.filter(r => {
    if (from && r.work_date < from) return false;
    if (to && r.work_date > to) return false;
    if (emp && !r.employee.toLowerCase().includes(emp)) return false;
    return true;
  });

  renderTable();
  renderSummary();
}

function renderTable() {
  let html = "<table><tr><th>Date</th><th>Employee</th><th>Item</th><th>Task</th><th>Qty</th><th>Total Time</th><th>Sec/Unit</th></tr>";

  reportData.forEach(r => {
    html += `<tr>
      <td>${r.work_date}</td>
      <td>${r.employee}</td>
      <td>${r.item}</td>
      <td>${r.task}</td>
      <td>${r.total_qty || 0}</td>
      <td>${secondsToHMS(r.total_time)}</td>
      <td>${Math.round(r.sec_per_unit || 0)}</td>
    </tr>`;
  });

  html += "</table>";
  document.getElementById("table").innerHTML = html;
}

function renderSummary() {
  let totalQty = 0;
  let totalTime = 0;

  reportData.forEach(r => {
    totalQty += r.total_qty || 0;
    totalTime += r.total_time || 0;
  });

  const avg = totalQty ? Math.round(totalTime / totalQty) : 0;

  document.getElementById("summary").innerHTML = `
    <b>Total Qty:</b> ${totalQty} |
    <b>Total Time:</b> ${secondsToHMS(totalTime)} |
    <b>Avg Sec/Unit:</b> ${avg}
  `;
}

function exportCSV() {
  if (!reportData.length) return;

  let csv = "Date,Employee,Item,Task,Qty,Total Time,Sec/Unit\n";

  reportData.forEach(r => {
    csv += `${r.work_date},${r.employee},${r.item},${r.task},${r.total_qty},${r.total_time},${Math.round(r.sec_per_unit || 0)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "report.csv";
  a.click();
}

// Auto-load on open
loadReport();