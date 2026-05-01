const express = require("express");
const db = require("./db");
const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// Get items
app.get("/items", (req, res) => {
  db.all("SELECT * FROM items", [], (err, rows) => {
    res.json(rows);
  });
});

// Get tasks
app.get("/tasks", (req, res) => {
  db.all("SELECT * FROM tasks", [], (err, rows) => {
    res.json(rows);
  });
});

// Start timer
app.post("/start", (req, res) => {
  const { item_id, task_id } = req.body;

  db.run(
    `INSERT INTO time_logs (item_id, task_id, start_time)
     VALUES (?, ?, datetime('now'))`,
    [item_id, task_id],
    function () {
      res.json({ log_id: this.lastID });
    }
  );
});

// Stop timer
app.post("/stop", (req, res) => {
  const { log_id, quantity } = req.body;

  db.run(
    `UPDATE time_logs
     SET end_time = datetime('now'),
         quantity = ?,
         duration_seconds = strftime('%s','now') - strftime('%s', start_time)
     WHERE id = ?`,
    [quantity, log_id],
    () => res.send("Saved")
  );
});

// Report
app.get("/report", (req, res) => {
  db.all(`
    SELECT items.name as item, tasks.name as task,
           SUM(quantity) as total_qty,
           SUM(duration_seconds) as total_time,
           SUM(duration_seconds) / SUM(quantity) as sec_per_unit
    FROM time_logs
    JOIN items ON items.id = time_logs.item_id
    JOIN tasks ON tasks.id = time_logs.task_id
    GROUP BY items.name, tasks.name
  `, [], (err, rows) => {
    res.json(rows);
  });
});

app.listen(PORT, () => console.log("Running on port " + PORT));