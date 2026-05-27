const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { createClient } = require("@libsql/client");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  });
}

function sqliteAll(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function sqliteClose(database) {
  return new Promise((resolve, reject) => {
    database.close(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function quoteName(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function execute(database, sql, args = []) {
  return database.execute({ sql, args });
}

async function withTursoTransaction(client, operation) {
  const transaction = await client.transaction("write");
  try {
    const result = await operation(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function tableExists(database, tableName) {
  const rows = await sqliteAll(
    database,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return rows.length > 0;
}

async function upsertTable(source, target, tableName, primaryKey) {
  if (!(await tableExists(source, tableName))) {
    return 0;
  }

  const rows = await sqliteAll(source, `SELECT * FROM ${quoteName(tableName)}`);
  if (!rows.length) return 0;

  const columns = Object.keys(rows[0]);
  const insertColumns = columns.map(quoteName).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const updateColumns = columns
    .filter(column => column !== primaryKey)
    .map(column => `${quoteName(column)} = excluded.${quoteName(column)}`)
    .join(", ");
  const sql =
    `INSERT INTO ${quoteName(tableName)} (${insertColumns}) ` +
    `VALUES (${placeholders}) ` +
    `ON CONFLICT(${quoteName(primaryKey)}) DO UPDATE SET ${updateColumns}`;

  for (const row of rows) {
    await execute(target, sql, columns.map(column => row[column]));
  }

  return rows.length;
}

async function ensurePrimarySchema(target) {
  await execute(target, `
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  await execute(target, `
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  await execute(target, `
    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      task_id INTEGER,
      employee TEXT,
      work_date TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_seconds INTEGER,
      paused_seconds INTEGER DEFAULT 0,
      pause_started_at TEXT,
      quantity INTEGER,
      dispensary_name TEXT
    )
  `);

  await execute(target, `
    CREATE TABLE IF NOT EXISTS schedule_days (
      schedule_date TEXT PRIMARY KEY,
      tasks TEXT DEFAULT '',
      updated_at TEXT
    )
  `);

  await execute(target, `
    CREATE TABLE IF NOT EXISTS ordered_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_ordered TEXT NOT NULL,
      expected_delivery_date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_company TEXT NOT NULL,
      package_qty INTEGER NOT NULL,
      units_per_package INTEGER,
      item_supplier TEXT NOT NULL,
      department TEXT NOT NULL,
      request_id INTEGER,
      requested_by TEXT,
      received_date TEXT,
      received_time TEXT,
      received_location TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await execute(target, `
    CREATE TABLE IF NOT EXISTS order_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_date TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      department TEXT,
      item_needed TEXT NOT NULL,
      qty_needed INTEGER NOT NULL,
      suggested_retailer TEXT,
      ordered_item_id INTEGER,
      ordered_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await execute(target, `
    CREATE TABLE IF NOT EXISTS backup_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL,
      backed_up_at TEXT DEFAULT (datetime('now')),
      table_counts TEXT NOT NULL
    )
  `);

  await ensureColumn(target, "time_logs", "item_id", "INTEGER");
  await ensureColumn(target, "time_logs", "task_id", "INTEGER");
  await ensureColumn(target, "time_logs", "employee", "TEXT");
  await ensureColumn(target, "time_logs", "work_date", "TEXT");
  await ensureColumn(target, "time_logs", "start_time", "TEXT");
  await ensureColumn(target, "time_logs", "end_time", "TEXT");
  await ensureColumn(target, "time_logs", "duration_seconds", "INTEGER");
  await ensureColumn(target, "time_logs", "paused_seconds", "INTEGER DEFAULT 0");
  await ensureColumn(target, "time_logs", "pause_started_at", "TEXT");
  await ensureColumn(target, "time_logs", "quantity", "INTEGER");
  await ensureColumn(target, "time_logs", "dispensary_name", "TEXT");
  await ensureColumn(target, "schedule_days", "tasks", "TEXT DEFAULT ''");
  await ensureColumn(target, "schedule_days", "updated_at", "TEXT");
  await ensureColumn(target, "ordered_items", "date_ordered", "TEXT");
  await ensureColumn(target, "ordered_items", "expected_delivery_date", "TEXT");
  await ensureColumn(target, "ordered_items", "item_name", "TEXT");
  await ensureColumn(target, "ordered_items", "item_company", "TEXT");
  await ensureColumn(target, "ordered_items", "package_qty", "INTEGER");
  await ensureColumn(target, "ordered_items", "units_per_package", "INTEGER");
  await ensureColumn(target, "ordered_items", "item_supplier", "TEXT");
  await ensureColumn(target, "ordered_items", "department", "TEXT");
  await ensureColumn(target, "ordered_items", "request_id", "INTEGER");
  await ensureColumn(target, "ordered_items", "requested_by", "TEXT");
  await ensureColumn(target, "ordered_items", "received_date", "TEXT");
  await ensureColumn(target, "ordered_items", "received_time", "TEXT");
  await ensureColumn(target, "ordered_items", "received_location", "TEXT");
  await ensureColumn(target, "ordered_items", "created_at", "TEXT");
  await ensureColumn(target, "ordered_items", "updated_at", "TEXT");
  await ensureColumn(target, "order_requests", "request_date", "TEXT");
  await ensureColumn(target, "order_requests", "requester_name", "TEXT");
  await ensureColumn(target, "order_requests", "department", "TEXT");
  await ensureColumn(target, "order_requests", "item_needed", "TEXT");
  await ensureColumn(target, "order_requests", "qty_needed", "INTEGER");
  await ensureColumn(target, "order_requests", "suggested_retailer", "TEXT");
  await ensureColumn(target, "order_requests", "ordered_item_id", "INTEGER");
  await ensureColumn(target, "order_requests", "ordered_at", "TEXT");
  await ensureColumn(target, "order_requests", "created_at", "TEXT");
  await ensureColumn(target, "order_requests", "updated_at", "TEXT");
}

async function ensureCalendarSchema(target) {
  await execute(target, `
    CREATE TABLE IF NOT EXISTS schedule_days (
      schedule_date TEXT PRIMARY KEY,
      tasks TEXT DEFAULT '',
      updated_at TEXT
    )
  `);

  await ensureColumn(target, "schedule_days", "tasks", "TEXT DEFAULT ''");
  await ensureColumn(target, "schedule_days", "updated_at", "TEXT");
}

async function ensureColumn(target, tableName, columnName, definition) {
  const result = await execute(target, `PRAGMA table_info(${quoteName(tableName)})`);
  const exists = result.rows.some(row => String(row.name) === columnName);
  if (exists) return;

  await execute(
    target,
    `ALTER TABLE ${quoteName(tableName)} ADD COLUMN ${quoteName(columnName)} ${definition}`
  );
}

async function main() {
  loadEnvFile();

  const sourcePath = path.resolve(
    process.env.SQLITE_BACKUP_SOURCE ||
    path.join(__dirname, "..", "data", "database.sqlite")
  );
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_DATABASE_TOKEN;

  if (!tursoUrl || !tursoToken) {
    throw new Error("TURSO_DATABASE_URL and TURSO_DATABASE_TOKEN are required to back up to Turso.");
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SQLite backup source not found: ${sourcePath}`);
  }

  const source = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);
  const tableCounts = {};

  try {
    const primary = createClient({ url: tursoUrl, authToken: tursoToken });

    await withTursoTransaction(primary, async transaction => {
      await ensurePrimarySchema(transaction);

      for (const [tableName, primaryKey] of [
        ["items", "id"],
        ["tasks", "id"],
        ["time_logs", "id"],
        ["schedule_days", "schedule_date"],
        ["ordered_items", "id"],
        ["order_requests", "id"]
      ]) {
        tableCounts[tableName] = await upsertTable(source, transaction, tableName, primaryKey);
      }

      await execute(
        transaction,
        "INSERT INTO backup_runs (source_path, table_counts) VALUES (?, ?)",
        [sourcePath, JSON.stringify(tableCounts)]
      );
    });

    if (process.env.TURSO_CALENDAR_URL && process.env.TURSO_CALENDAR_TOKEN) {
      const calendar = createClient({
        url: process.env.TURSO_CALENDAR_URL,
        authToken: process.env.TURSO_CALENDAR_TOKEN
      });

      await withTursoTransaction(calendar, async transaction => {
        await ensureCalendarSchema(transaction);
        tableCounts.calendar_schedule_days = await upsertTable(
          source,
          transaction,
          "schedule_days",
          "schedule_date"
        );
      });
    }
  } finally {
    await sqliteClose(source);
  }
  console.log("Backed up SQLite data to Turso:");
  Object.entries(tableCounts).forEach(([tableName, count]) => {
    console.log(`- ${tableName}: ${count}`);
  });
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
