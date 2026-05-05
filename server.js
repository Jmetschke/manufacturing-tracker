console.log("SERVER ACTIVE - CORRECT FILE");

const express = require("express");
const db = require("./db");
const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

/* ---------- ENSURE TABLE EXISTS ---------- */
db.run(`
  CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    task_id INTEGER,
    employee TEXT,
    work_date TEXT,
    start_time TEXT,
    end_time TEXT,
    duration_seconds INTEGER,
    quantity INTEGER
  )
`);

/* ---------- ITEMS ---------- */
app.get("/items", (req, res) => {
  db.all("SELECT * FROM items", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

/* ---------- TASKS ---------- */
app.get("/tasks", (req, res) => {
  db.all("SELECT * FROM tasks", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

/* ---------- START TIMER ---------- */
app.post("/start", (req, res) => {
  const { item_id, task_id, employee, work_date } = req.body;

  if (!employee || !work_date) {
    return res.status(400).send("Employee and date are required");
  }

  if (!item_id || !task_id) {
    return res.status(400).send("Item and task are required");
  }

  db.run(
    `INSERT INTO time_logs (item_id, task_id, employee, work_date, start_time)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [item_id, task_id, employee, work_date],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }

      res.json({ log_id: this.lastID });
    }
  );
});

/* ---------- STOP TIMER ---------- */
app.post("/stop", (req, res) => {
  const { log_id } = req.body;

  if (!log_id) {
    return res.status(400).send("Missing log_id");
  }

  db.run(
    `UPDATE time_logs
     SET end_time = datetime('now'),
         duration_seconds = strftime('%s','now') - strftime('%s', start_time)
     WHERE id = ?
     AND end_time IS NULL`,
    [log_id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      if (this.changes === 0) {
        return res.status(400).send("Timer already stopped or invalid log_id");
      }

      res.json({ message: "Stopped", log_id });
    }
  );
});

/* ---------- UPDATE QTY ---------- */
app.post("/update-qty", (req, res) => {
  let { log_id, quantity } = req.body;

  if (!log_id) {
    return res.status(400).send("Missing log_id");
  }

  quantity = parseInt(quantity);
  if (isNaN(quantity)) {
    return res.status(400).send("Invalid quantity");
  }

  db.run(
    `UPDATE time_logs
     SET quantity = ?
     WHERE id = ?
     AND end_time IS NOT NULL`,
    [quantity, log_id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      if (this.changes === 0) {
        return res.status(400).send("Stop timer before setting quantity");
      }

      res.json({ message: "Quantity updated" });
    }
  );
});

/* ---------- LOGS (DEBUG) ---------- */
app.get("/logs", (req, res) => {
  db.all("SELECT * FROM time_logs", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

 /* ---------- REPORT (FIXED) ---------- */
app.get("/report", (req, res) => {
  db.all(`
    SELECT 
      COALESCE(i.name, 'Unknown Item') AS item,
      COALESCE(t.name, 'Unknown Task') AS task,
      l.employee,
      l.work_date,
      SUM(COALESCE(l.quantity, 0)) AS total_qty,
      SUM(COALESCE(l.duration_seconds, 0)) AS total_time,
      CASE 
        WHEN SUM(COALESCE(l.quantity, 0)) = 0 THEN 0
        ELSE SUM(COALESCE(l.duration_seconds, 0)) / SUM(COALESCE(l.quantity, 0))
      END AS sec_per_unit
    FROM time_logs l
    LEFT JOIN items i ON i.id = l.item_id
    LEFT JOIN tasks t ON t.id = l.task_id
    GROUP BY l.employee, l.work_date, i.name, t.name
    ORDER BY l.work_date DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("REPORT ERROR:", err);
      return res.status(500).send(err.message);
    }

    res.json(rows);
  });
});

/* ---------- START SERVER ---------- */
app.listen(PORT, () => {
  console.log("Running on port " + PORT);
});