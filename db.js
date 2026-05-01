const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data/database.sqlite");

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    task_id INTEGER,
    quantity INTEGER,
    start_time TEXT,
    end_time TEXT,
    duration_seconds INTEGER
  )`);

  // Seed basic data
  db.run(`INSERT INTO items (name) VALUES ('Item A'), ('Item B')`);
  db.run(`INSERT INTO tasks (name) VALUES ('Cutting'), ('Assembly')`);
});

module.exports = db;