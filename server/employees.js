const defaults = require("./default-employees.json");
module.exports = function createEmployees({ runSql, allSql, withTransaction }) {
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
    async rename(value, rawName) {
      const id = Number(value);
      const name = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
      if (!Number.isSafeInteger(id) || id <= 0 || !name || name.length > 100) {
        throw Object.assign(new Error("Enter a valid employee name of 1–100 characters."), { status: 400 });
      }
      await withTransaction(async transaction => {
        const [current] = await allSql("SELECT id, name FROM employee_choices WHERE id = ? AND active = 1", [id], transaction);
        if (!current) throw Object.assign(new Error("Employee choice no longer exists. Refresh the list."), { status: 404 });
        const [existing] = await allSql("SELECT id, active FROM employee_choices WHERE name = ? COLLATE NOCASE", [name], transaction);
        if (existing && existing.id === current.id) {
          await runSql("UPDATE employee_choices SET name = ? WHERE id = ?", [name, id], transaction);
          return;
        }
        if (existing && existing.active) throw Object.assign(new Error("That employee name is already in the list."), { status: 409 });
        // Retain the old choice as inactive so default seeding cannot restore it.
        await runSql("INSERT INTO employee_choices (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name = excluded.name, active = 1", [name], transaction);
        await runSql("UPDATE employee_choices SET active = 0 WHERE id = ?", [id], transaction);
      });
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
