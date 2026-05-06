const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");

// Make sure the data folder exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, "database.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("DATABASE OPEN ERROR:", err.message);
  } else {
    console.log("Connected to SQLite database:", dbPath);
  }
});

module.exports = db;