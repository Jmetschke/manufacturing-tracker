const defaults = require("./default-employees.json");
module.exports = function createEmployees({ runSql, allSql }) {
  return {
    async initialize() {
      await runSql(`CREATE TABLE IF NOT EXISTS employee_choices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        active INTEGER NOT NULL DEFAULT 1
      )`);
      // Keep inactive rows so removed defaults are never restored on restart.
      for (const name of defaults) {
        await runSql("INSERT OR IGNORE INTO employee_choices (name) VALUES (?)", [name]);
      }
    },
    list() {
      return allSql("SELECT id, name FROM employee_choices WHERE active = 1 ORDER BY name COLLATE NOCASE");
    },
    async add(value) {
      const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
      if (!name || name.length > 100) {
        throw Object.assign(new Error("Enter an employee name of 1–100 characters."), { status: 400 });
      }
      await runSql(`INSERT INTO employee_choices (name) VALUES (?)
        ON CONFLICT(name) DO UPDATE SET active = 1`, [name]);
    },
    async remove(value) {
      const id = Number(value);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw Object.assign(new Error("Invalid employee choice."), { status: 400 });
      }
      await runSql("UPDATE employee_choices SET active = 0 WHERE id = ?", [id]);
    }
  };
};
