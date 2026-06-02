console.log("SERVER ACTIVE - CORRECT FILE");

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");
const calendarDb = db.calendar || db;
const hasSeparateCalendarDb = calendarDb !== db;
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE || "5838";
const ADMIN_ACCESS_CODE = process.env.ADMIN_ACCESS_CODE || "0187";
const ACCESS_COOKIE = "manufacturing_tracker_access";
const ADMIN_ACCESS_COOKIE = "manufacturing_tracker_admin_access";
const ACCESS_SECRET = process.env.ACCESS_SESSION_SECRET || `${ACCESS_CODE}:${ADMIN_ACCESS_CODE}`;

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {
        const equalsIndex = cookie.indexOf("=");
        if (equalsIndex === -1) return [cookie, ""];
        return [
          decodeURIComponent(cookie.slice(0, equalsIndex)),
          decodeURIComponent(cookie.slice(equalsIndex + 1))
        ];
      })
  );
}

function createAccessToken(level) {
  return crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(`${level}-access-granted`)
    .digest("hex");
}

function hasAdminAccess(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[ADMIN_ACCESS_COOKIE] === createAccessToken("admin");
}

function hasAppAccess(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[ACCESS_COOKIE] === createAccessToken("app") || hasAdminAccess(req);
}

function sendAccessCookie(res, level) {
  const cookieName = level === "admin" ? ADMIN_ACCESS_COOKIE : ACCESS_COOKIE;

  res.cookie(cookieName, createAccessToken(level), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}

function clearAccessCookie(res) {
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  res.clearCookie(ADMIN_ACCESS_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}

function isAdminPath(pathname) {
  return pathname === "/admin.html" || pathname.startsWith("/admin/");
}

function getSafeNextPath(rawValue) {
  const nextPath = String(rawValue || "/");
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/";
  if (nextPath === "/access" || nextPath === "/access.html") return "/";
  return nextPath;
}

function accessRedirect(nextPath) {
  return `/access?next=${encodeURIComponent(nextPath)}`;
}

app.get("/access", (req, res) => {
  const nextPath = getSafeNextPath(req.query.next);
  if (isAdminPath(nextPath) && hasAdminAccess(req)) return res.redirect(nextPath);
  if (!isAdminPath(nextPath) && hasAppAccess(req)) return res.redirect(nextPath);
  res.sendFile(path.join(__dirname, "public", "access.html"));
});

app.get("/access.html", (req, res) => {
  const nextPath = getSafeNextPath(req.query.next);
  if (isAdminPath(nextPath) && hasAdminAccess(req)) return res.redirect(nextPath);
  if (!isAdminPath(nextPath) && hasAppAccess(req)) return res.redirect(nextPath);
  res.sendFile(path.join(__dirname, "public", "access.html"));
});

app.post("/access", (req, res) => {
  const submittedCode = String(req.body.code || "");
  const nextPath = getSafeNextPath(req.body.next);

  if (submittedCode === ADMIN_ACCESS_CODE) {
    sendAccessCookie(res, "admin");
    return res.json({ message: "Admin access granted", redirect: nextPath || "/admin.html" });
  }

  if (submittedCode === ACCESS_CODE) {
    sendAccessCookie(res, "app");
    return res.json({
      message: "Access granted",
      redirect: isAdminPath(nextPath) ? "/" : nextPath
    });
  }

  return res.status(401).json({ message: "Invalid access code" });
});

app.post("/logout", (req, res) => {
  clearAccessCookie(res);
  res.json({ message: "Access cleared" });
});

app.use((req, res, next) => {
  if (isAdminPath(req.path)) {
    if (hasAdminAccess(req)) return next();

    const acceptsHtml = (req.headers.accept || "").includes("text/html");
    if (acceptsHtml || req.method === "GET") {
      return res.redirect(accessRedirect(req.originalUrl));
    }

    return res.status(403).json({ message: "Admin access code required" });
  }

  if (hasAppAccess(req)) return next();

  const acceptsHtml = (req.headers.accept || "").includes("text/html");
  if (acceptsHtml || req.method === "GET") {
    return res.redirect(accessRedirect(req.originalUrl));
  }

  return res.status(401).json({ message: "Access code required" });
});

app.use(express.static("public"));

const itemNames = [
  "Daytime Focus Micro Pump",
  "Good Night Sleep Micro Pump",
  "Main Squeeze Party Pouch",
  "Micro Dots (50-piece packs)",
  "RSO Whoopie Hi",
  "Space Chunk OG 1 chunk (pcs)",
  "Space Chunk ALPHA OG 2 chunk (units)",
  "Space Chunk REX OG 1 chunk (units)",
  "Space Chunk REX OG 2 chunk (units)",
  "Space Chunk ZUUL OG 1 chunk (units)",
  "Space Chunk ZUUL OG 2 chunk (units)",
  "Space Chunk 1 chunk CBD 50mg 1-1 (pcs)",
  "Space Chunks CBD 2 chunks 1-1 (units)",
  "Space Chunk CBN 1 chunk (pcs)",
  "Space Chunk CBN 2 chunk (units)",
  "Space Chunk Mini 10 chunk (units)",
  "Space Chunk SUGAR FREE 10pk (units)",
  "Space Chunk SUGAR FREE 2pk (units)",
  "Shooters Triple Citrus",
  "Shooters Sour Watermelon",
  "Shooters Sour Blu Raz",
  "Grape 1g",
  "Mango 1g",
  "Lemon 1g",
  "Watermelon 1g",
  "Big Stick",
  "Small Stick",
  "Tiny Stick",
  "Swag",
  "Delivery Order"
];

const taskNames = [
  "FIlling (Slot Machine)",
  "Filling (Filling Machine)",
  "Filling (SB Vapes)",
  "FIlling (Hijnx Vapes)",
  "Depositing (truffly)",
  "Depositing (muffly)",
  "Depositing (Beldos)",
  "Cooking (kettle)",
  "Capping (shooters)",
  "Capping (SB Vapes)",
  "Capping (Hijnx Vapes)",
  "Capping (Tinctures)",
  "Capping (Topicals)",
  "Packaging",
  "Popping",
  "Sugaring",
  "Nerding",
  "Sealing",
  "Bagging (10's)",
  "Bagging (20's)",
  "Bagging (SB 25's)",
  "Counting (5's)",
  "Counting (SB 5's)",
  "Exit Label Stickering",
  "Packaging Labels Stickering",
  "Correction Stickering",
  "Seal-Stickering (shooters)",
  "Swag Press",
  "Swag Assembly",
  "Swag Counting",
  "Pulling/Seperating Order",
  "Counting/Verifying Order"
];

const itemTaskNames = Object.freeze({
  "Daytime Focus Micro Pump": [
    "FIlling (Slot Machine)",
    "Capping (Tinctures)",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)"
  ],
  "Good Night Sleep Micro Pump": [
    "FIlling (Slot Machine)",
    "Capping (Tinctures)",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)"
  ],
  "Main Squeeze Party Pouch": [
    "Depositing (Beldos)",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (10's)"
  ],
  "Micro Dots (50-piece packs)": [
    "Popping",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)"
  ],
  "RSO Whoopie Hi": [
    "Depositing (Beldos)",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (10's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk OG 1 chunk (pcs)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk ALPHA OG 2 chunk (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk REX OG 1 chunk (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk REX OG 2 chunk (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk ZUUL OG 1 chunk (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk ZUUL OG 2 chunk (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk 1 chunk CBD 50mg 1-1 (pcs)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunks CBD 2 chunks 1-1 (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk CBN 1 chunk (pcs)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk CBN 2 chunk (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk Mini 10 chunk (units)": [
    "Depositing (muffly)",
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk SUGAR FREE 10pk (units)": [
    "Depositing (muffly)",
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Space Chunk SUGAR FREE 2pk (units)": [
    "Depositing (truffly)",
    "Nerding",
    "Popping",
    "Sugaring",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)",
    "Packaging Labels Stickering",
    "Correction Stickering"
  ],
  "Shooters Triple Citrus": [
    "Filling (Filling Machine)",
    "Capping (shooters)",
    "Seal-Stickering (shooters)",
    "Bagging (10's)"
  ],
  "Shooters Sour Watermelon": [
    "Filling (Filling Machine)",
    "Capping (shooters)",
    "Seal-Stickering (shooters)",
    "Bagging (10's)"
  ],
  "Shooters Sour Blu Raz": [
    "Filling (Filling Machine)",
    "Capping (shooters)",
    "Seal-Stickering (shooters)",
    "Bagging (10's)"
  ],
  "Grape 1g": [
    "Filling (SB Vapes)",
    "Capping (SB Vapes)",
    "Sealing",
    "Counting (SB 5's)",
    "Bagging (SB 25's)"
  ],
  "Mango 1g": [
    "Filling (SB Vapes)",
    "Capping (SB Vapes)",
    "Sealing",
    "Counting (SB 5's)",
    "Bagging (SB 25's)"
  ],
  "Lemon 1g": [
    "Filling (SB Vapes)",
    "Capping (SB Vapes)",
    "Sealing",
    "Counting (SB 5's)",
    "Bagging (SB 25's)"
  ],
  "Watermelon 1g": [
    "Filling (SB Vapes)",
    "Capping (SB Vapes)",
    "Sealing",
    "Counting (SB 5's)",
    "Bagging (SB 25's)"
  ],
  "Big Stick": [
    "Filling (Filling Machine)",
    "Capping (Topicals)",
    "Packaging",
    "Sealing",
    "Bagging (10's)"
  ],
  "Small Stick": [
    "Filling (Filling Machine)",
    "Capping (Topicals)",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)"
  ],
  "Tiny Stick": [
    "Filling (Filling Machine)",
    "Capping (Topicals)",
    "Packaging",
    "Sealing",
    "Counting (5's)",
    "Bagging (20's)"
  ],
  "Swag": [
    "Swag Press",
    "Swag Assembly",
    "Swag Counting"
  ],
  "Delivery Order": [
    "Exit Label Stickering",
    "Pulling/Seperating Order",
    "Counting/Verifying Order"
  ]
});

const globalItemTaskNames = Object.freeze([
  "Exit Label Stickering"
]);

function runSql(sql, params = [], database = db) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function withTransaction(operation, database = db) {
  if (typeof database.transaction === "function") {
    const transaction = await database.transaction("write");

    try {
      const result = await operation(transaction);
      await transaction.commit();
      return result;
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr.message);
      }
      throw err;
    }
  }

  await runSql("BEGIN TRANSACTION", [], database);

  try {
    const result = await operation(database);
    await runSql("COMMIT", [], database);
    return result;
  } catch (err) {
    try {
      await runSql("ROLLBACK", [], database);
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr.message);
    }
    throw err;
  }
}

function allSql(sql, params = [], database = db) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function addMissingColumn(table, column, definition, database = db) {
  const columns = await allSql(`PRAGMA table_info(${table})`, [], database);
  const exists = columns.some(c => c.name === column);
  if (exists) return false;

  await runSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], database);
  console.log(`Added missing column: ${table}.${column}`);
  return true;
}

async function seedNames(table, names) {
  for (const name of names) {
    await runSql(`
      INSERT INTO ${table} (name)
      SELECT ?
      WHERE NOT EXISTS (
        SELECT 1 FROM ${table} WHERE name = ?
      )
    `, [name, name]);
  }
}

async function removeNames(table, names) {
  for (const name of names) {
    await runSql(`DELETE FROM ${table} WHERE name = ?`, [name]);
  }
}

async function logLookupCount(table) {
  const rows = await allSql(`SELECT COUNT(*) AS count FROM ${table}`);
  console.log(`${table} rows: ${rows[0].count}`);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isWeekendIsoDate(value) {
  if (!isIsoDate(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0 || date.getDay() === 6;
}

function parseSchedulePayloadForCleanup(rawValue) {
  const empty = {
    batchHijnx: [],
    batchSb: [],
    events: [],
    tasks: [],
    testPickups: [],
    processingTasks: []
  };

  if (!rawValue) return empty;

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      return {
        batchHijnx: Array.isArray(parsed.batchHijnx) ? parsed.batchHijnx : [],
        batchSb: Array.isArray(parsed.batchSb) ? parsed.batchSb : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        testPickups: Array.isArray(parsed.testPickups) ? parsed.testPickups : [],
        processingTasks: Array.isArray(parsed.processingTasks) ? parsed.processingTasks : []
      };
    }

    if (Array.isArray(parsed)) {
      return {
        ...empty,
        tasks: parsed
      };
    }
  } catch (err) {
    return {
      ...empty,
      tasks: String(rawValue)
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(text => ({ text, days: 1 }))
    };
  }

  return empty;
}

function removeScheduleTasks(rawValue) {
  const payload = parseSchedulePayloadForCleanup(rawValue);
  payload.tasks = [];
  return JSON.stringify(payload);
}

async function clearWeekendScheduleTasks() {
  const rows = await allSql("SELECT schedule_date, tasks FROM schedule_days");

  for (const row of rows) {
    if (!isWeekendIsoDate(row.schedule_date)) continue;

    const payload = parseSchedulePayloadForCleanup(row.tasks);
    if (!payload.tasks.length) continue;

    payload.tasks = [];
    const updatePrimary = runSql(
      "UPDATE schedule_days SET tasks = ?, updated_at = datetime('now') WHERE schedule_date = ?",
      [JSON.stringify(payload), row.schedule_date]
    );

    if (hasSeparateCalendarDb) {
      await Promise.all([
        updatePrimary,
        runSql(
          "UPDATE schedule_days SET tasks = ?, updated_at = datetime('now') WHERE schedule_date = ?",
          [JSON.stringify(payload), row.schedule_date],
          calendarDb
        )
      ]);
    } else {
      await updatePrimary;
    }

    console.log(`Removed weekend calendar tasks from ${row.schedule_date}`);
  }
}

async function writeScheduleDayToDatabases(scheduleDate, tasks) {
  const sql = `
    INSERT INTO schedule_days (schedule_date, tasks, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(schedule_date) DO UPDATE SET
      tasks = excluded.tasks,
      updated_at = excluded.updated_at
  `;

  if (hasSeparateCalendarDb) {
    const [primaryResult] = await Promise.all([
      runSql(sql, [scheduleDate, tasks]),
      runSql(sql, [scheduleDate, tasks], calendarDb)
    ]);
    return primaryResult;
  }

  return runSql(sql, [scheduleDate, tasks]);
}

async function reconcileCalendarDatabase() {
  if (!hasSeparateCalendarDb) return;

  const rows = await allSql(`
    SELECT schedule_date, tasks, updated_at
    FROM schedule_days
  `);

  const sql = `
    INSERT INTO schedule_days (schedule_date, tasks, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(schedule_date) DO UPDATE SET
      tasks = excluded.tasks,
      updated_at = excluded.updated_at
  `;

  for (const row of rows) {
    await runSql(sql, [
      row.schedule_date,
      row.tasks || "",
      row.updated_at || null
    ], calendarDb);
  }

  console.log(`Reconciled ${rows.length} calendar rows from primary database to calendar database.`);
}

async function initializeDatabase() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  await runSql(`
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

  await runSql(`
    CREATE TABLE IF NOT EXISTS schedule_days (
      schedule_date TEXT PRIMARY KEY,
      tasks TEXT DEFAULT '',
      updated_at TEXT
    )
  `);

  if (hasSeparateCalendarDb) {
    await runSql(`
      CREATE TABLE IF NOT EXISTS schedule_days (
        schedule_date TEXT PRIMARY KEY,
        tasks TEXT DEFAULT '',
        updated_at TEXT
      )
    `, [], calendarDb);
  }

  await runSql(`
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
      import_needs_delivery_date INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await runSql(`
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

  await addMissingColumn("time_logs", "item_id", "INTEGER");
  await addMissingColumn("time_logs", "task_id", "INTEGER");
  await addMissingColumn("time_logs", "employee", "TEXT");
  await addMissingColumn("time_logs", "work_date", "TEXT");
  await addMissingColumn("time_logs", "start_time", "TEXT");
  await addMissingColumn("time_logs", "end_time", "TEXT");
  await addMissingColumn("time_logs", "duration_seconds", "INTEGER");
  await addMissingColumn("time_logs", "paused_seconds", "INTEGER DEFAULT 0");
  await addMissingColumn("time_logs", "pause_started_at", "TEXT");
  await addMissingColumn("time_logs", "quantity", "INTEGER");
  await addMissingColumn("time_logs", "dispensary_name", "TEXT");
  await addMissingColumn("schedule_days", "tasks", "TEXT DEFAULT ''");
  await addMissingColumn("schedule_days", "updated_at", "TEXT");
  if (hasSeparateCalendarDb) {
    await addMissingColumn("schedule_days", "tasks", "TEXT DEFAULT ''", calendarDb);
    await addMissingColumn("schedule_days", "updated_at", "TEXT", calendarDb);
  }
  await addMissingColumn("ordered_items", "date_ordered", "TEXT");
  await addMissingColumn("ordered_items", "expected_delivery_date", "TEXT");
  await addMissingColumn("ordered_items", "item_name", "TEXT");
  await addMissingColumn("ordered_items", "item_company", "TEXT");
  await addMissingColumn("ordered_items", "package_qty", "INTEGER");
  await addMissingColumn("ordered_items", "units_per_package", "INTEGER");
  await addMissingColumn("ordered_items", "item_supplier", "TEXT");
  await addMissingColumn("ordered_items", "department", "TEXT");
  await addMissingColumn("ordered_items", "request_id", "INTEGER");
  await addMissingColumn("ordered_items", "requested_by", "TEXT");
  await addMissingColumn("ordered_items", "received_date", "TEXT");
  await addMissingColumn("ordered_items", "received_time", "TEXT");
  await addMissingColumn("ordered_items", "received_location", "TEXT");
  await addMissingColumn("ordered_items", "import_needs_delivery_date", "INTEGER DEFAULT 0");
  await addMissingColumn("ordered_items", "created_at", "TEXT");
  await addMissingColumn("ordered_items", "updated_at", "TEXT");
  await addMissingColumn("order_requests", "request_date", "TEXT");
  await addMissingColumn("order_requests", "requester_name", "TEXT");
  await addMissingColumn("order_requests", "department", "TEXT");
  await addMissingColumn("order_requests", "item_needed", "TEXT");
  await addMissingColumn("order_requests", "qty_needed", "INTEGER");
  await addMissingColumn("order_requests", "suggested_retailer", "TEXT");
  await addMissingColumn("order_requests", "ordered_item_id", "INTEGER");
  await addMissingColumn("order_requests", "ordered_at", "TEXT");
  await addMissingColumn("order_requests", "created_at", "TEXT");
  await addMissingColumn("order_requests", "updated_at", "TEXT");
  await reconcileCalendarDatabase();
  await clearWeekendScheduleTasks();

  await seedNames("items", itemNames);
  await removeNames("items", ["Item A", "Item B"]);
  await seedNames("tasks", taskNames);
  await removeNames("tasks", ["Assembly", "Cutting"]);
  await logLookupCount("items");
  await logLookupCount("tasks");
}

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

app.get("/item-task-options", async (req, res) => {
  try {
    const [items, tasks] = await Promise.all([
      allSql("SELECT id, name FROM items"),
      allSql("SELECT id, name FROM tasks")
    ]);
    const itemIdsByName = new Map(items.map(item => [item.name, item.id]));
    const taskIdsByName = new Map(tasks.map(task => [task.name, task.id]));
    const optionsByItemId = {};

    Object.entries(itemTaskNames).forEach(([itemName, taskNamesForItem]) => {
      const itemId = itemIdsByName.get(itemName);
      if (!itemId) return;

      optionsByItemId[itemId] = [...new Set([...taskNamesForItem, ...globalItemTaskNames])]
        .map(taskName => taskIdsByName.get(taskName))
        .filter(taskId => taskId !== undefined);
    });

    res.json(optionsByItemId);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ---------- SCHEDULE ---------- */
app.get("/schedule", (req, res) => {
  const { from, to } = req.query;

  if (!isIsoDate(from) || !isIsoDate(to)) {
    return res.status(400).send("Valid from and to dates are required");
  }

  db.all(
    `SELECT schedule_date, tasks, updated_at
     FROM schedule_days
     WHERE schedule_date BETWEEN ? AND ?
     ORDER BY schedule_date`,
    [from, to],
    (err, rows) => {
      if (err) return res.status(500).send(err.message);
      res.json(rows);
    }
  );
});

app.put("/admin/schedule/:date", (req, res) => {
  const scheduleDate = req.params.date;
  const tasks = String(req.body.tasks || "").trim();

  if (!isIsoDate(scheduleDate)) {
    return res.status(400).send("Invalid schedule date");
  }

  if (tasks.length > 5000) {
    return res.status(400).send("Tasks are too long");
  }

  const savedTasks = isWeekendIsoDate(scheduleDate) ? removeScheduleTasks(tasks) : tasks;

  writeScheduleDayToDatabases(scheduleDate, savedTasks)
    .then(() => {
      res.json({ message: "Schedule updated", schedule_date: scheduleDate, tasks: savedTasks });
    })
    .catch(err => res.status(500).send(err.message));
});

function orderedItemsSelect(whereClause = "") {
  return `
    SELECT
      id,
      date_ordered,
      expected_delivery_date,
      item_name,
      item_company,
      package_qty,
      units_per_package,
      item_supplier,
      department,
      request_id,
      requested_by,
      received_date,
      received_time,
      received_location,
      COALESCE(import_needs_delivery_date, 0) AS import_needs_delivery_date,
      created_at,
      updated_at
    FROM ordered_items
    ${whereClause}
    ORDER BY
      CASE WHEN received_date IS NULL THEN 0 ELSE 1 END,
      expected_delivery_date ASC,
      date_ordered ASC,
      id DESC
  `;
}

function normalizeRequiredText(value) {
  return String(value || "").trim();
}

function decodePdfString(value) {
  let decoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      decoded += char;
      continue;
    }

    const next = value[index + 1];
    index += 1;

    if (next === "n") decoded += "\n";
    else if (next === "r") decoded += "\r";
    else if (next === "t") decoded += "\t";
    else if (next === "b") decoded += "\b";
    else if (next === "f") decoded += "\f";
    else if (/[0-7]/.test(next || "")) {
      let octal = next;
      while (octal.length < 3 && /[0-7]/.test(value[index + 1] || "")) {
        octal += value[index + 1];
        index += 1;
      }
      decoded += String.fromCharCode(parseInt(octal, 8));
    } else {
      decoded += next || "";
    }
  }

  return decoded;
}

function extractPdfTextLines(buffer) {
  const zlib = require("zlib");
  const binary = buffer.toString("binary");
  const streamPattern = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const lines = [];
  let match;

  while ((match = streamPattern.exec(binary))) {
    let content;
    if (/FlateDecode/.test(match[1])) {
      try {
        content = zlib.inflateSync(Buffer.from(match[2], "binary")).toString("latin1");
      } catch (err) {
        continue;
      }
    } else {
      content = match[2];
    }

    if (!/\bT[Jj]\b/.test(content)) continue;

    const textPattern = /\[((?:[^\[\]]|\([^()\\]*(?:\\.[^()\\]*)*\))*)\]\s*TJ|\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let textMatch;
    while ((textMatch = textPattern.exec(content))) {
      const text = textMatch[1]
        ? Array.from(textMatch[1].matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g))
            .map(part => decodePdfString(part[1]))
            .join("")
        : decodePdfString(textMatch[2]);

      const cleaned = text.replace(/\s+/g, " ").trim();
      if (cleaned) lines.push(cleaned);
    }
  }

  return lines;
}

function parseAmazonDate(value, fallbackYear = new Date().getFullYear()) {
  const text = String(value || "").replace(/,/g, "").trim();
  const match = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:\s+(\d{4}))?/i);
  const numericMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!match && !numericMatch) return "";

  if (numericMatch) {
    const month = Number(numericMatch[1]) - 1;
    const day = Number(numericMatch[2]);
    const rawYear = numericMatch[3] ? Number(numericMatch[3]) : fallbackYear;
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return isoDateFromParts(year, month, day);
  }

  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = monthNames.findIndex(name => match[1].toLowerCase().startsWith(name));
  const day = Number(match[2]);
  const year = Number(match[3] || fallbackYear);
  if (month < 0 || !Number.isInteger(day) || !Number.isInteger(year)) return "";

  return isoDateFromParts(year, month, day);
}

function isoDateFromParts(year, monthIndex, day) {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return "";

  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return "";
  }

  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addIsoDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIsoDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseWeekdayDeliveryDate(line, orderDate) {
  if (!orderDate) return "";

  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const text = String(line || "").toLowerCase();
  const weekdayIndex = weekdayNames.findIndex(day => new RegExp(`\\b${day}\\b`).test(text));
  if (weekdayIndex < 0) return "";

  const [year, month, day] = orderDate.split("-").map(Number);
  const order = new Date(year, month - 1, day);
  const daysAhead = (weekdayIndex - order.getDay() + 7) % 7 || 7;
  return addIsoDays(orderDate, daysAhead);
}

function parseAmazonDeliveryDate(line, orderDate) {
  const text = String(line || "").toLowerCase();
  if ((text.includes("tomorrow") || text.includes("tommorow")) && orderDate) return addIsoDays(orderDate, 1);
  if (text.includes("today") && orderDate) return orderDate;

  const fallbackYear = orderDate ? Number(orderDate.slice(0, 4)) : new Date().getFullYear();
  let parsed = parseAmazonDate(line, fallbackYear);
  if (parsed && orderDate && parsed < orderDate) {
    parsed = parseAmazonDate(line, fallbackYear + 1);
  }

  return parsed || parseWeekdayDeliveryDate(line, orderDate) || orderDate || "";
}

function isDeliveryStatusLine(value) {
  return /^(Arriving|Delivered|Delivery|Expected delivery)\b/i.test(String(value || ""));
}

function isDeliveredStatusLine(value) {
  return /^Delivered\b/i.test(String(value || ""));
}

function isAmazonItemNoiseLine(line) {
  const text = String(line || "").trim();
  if (!text) return true;
  if (/^Your package\b/i.test(text)) return true;
  if (/^Return or replace items:/i.test(text)) return true;
  if (/^Supplied by:/i.test(text) || /^Other$/i.test(text)) return true;
  if (/^\$/.test(text)) return true;
  if (/^(Buy it again|View order details|Write a product review|Archive order|Problem with order)$/i.test(text)) return true;
  if (/^(Order Summary|Payment method|Ship to|Print|Back to top)$/i.test(text)) return true;
  if (/^(Item\(s\) Subtotal|Shipping & Handling|Total before tax|Estimated tax|Grand Total):?/i.test(text)) return true;
  if (parseAmazonDate(text)) return true;
  return false;
}

function findInlineValue(line, labelPattern) {
  const match = String(line || "").match(labelPattern);
  return match ? normalizeRequiredText(match[1]) : "";
}

function findNearbyDate(lines, index, windowSize = 3) {
  for (let offset = 0; offset <= windowSize; offset += 1) {
    const before = lines[index - offset];
    const after = lines[index + offset];
    const beforeDate = parseAmazonDate(before);
    if (beforeDate) return beforeDate;
    const afterDate = parseAmazonDate(after);
    if (afterDate) return afterDate;
  }

  return "";
}

function findInvoiceDate(lines) {
  const labelPatterns = [
    /^(Invoice Date|Order placed|Order Date|Date Ordered|Purchase Date|Transaction Date)$/i,
    /^(Invoice Date|Order Date|Date Ordered|Purchase Date|Transaction Date)\b/i
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!labelPatterns.some(pattern => pattern.test(line))) continue;

    const inlineDate = parseAmazonDate(line);
    if (inlineDate) return inlineDate;

    const nearbyDate = findNearbyDate(lines, index, 2);
    if (nearbyDate) return nearbyDate;
  }

  return lines.map(line => parseAmazonDate(line)).find(Boolean) || "";
}

function findDeliveredDate(lines, orderDate = "") {
  const patterns = [
    /^Delivered\b/i,
    /^(Delivery Date|Date Delivered|Delivered Date|Received Date)$/i,
    /^(Delivery Date|Date Delivered|Delivered Date|Received Date)\b/i,
    /\bdelivered\b/i
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!patterns.some(pattern => pattern.test(line))) continue;

    const parsed = parseAmazonDeliveryDate(line, orderDate);
    if (parsed) return parsed;

    const nearbyDate = findNearbyDate(lines, index, 2);
    if (nearbyDate) return nearbyDate;
  }

  return "";
}

function findInvoiceNumber(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inlineMatch = line.match(/\b(?:Invoice|Order|PO|Receipt)\s*#?\s*[:#]\s*([A-Z0-9-]+)/i);
    if (inlineMatch) return inlineMatch[1];

    if (/^(Invoice|Order|PO|Receipt)\s*#?$/i.test(line)) {
      const value = normalizeRequiredText(lines[index + 1]);
      if (value) return value;
    }
  }

  return "";
}

function isGenericInvoiceNoiseLine(line) {
  const text = String(line || "").trim();
  if (!text) return true;
  if (text.startsWith("https://") || text.startsWith("http://")) return true;
  if (/^Page\s+\d+/i.test(text)) return true;
  if (/^(Invoice|Receipt|Order|Order #|Invoice #|PO #|Date|Invoice Date|Order Date|Delivery Date|Date Delivered|Delivered Date|Received Date)$/i.test(text)) return true;
  if (/^(Ship To|Bill To|Sold by|Sold By:|Supplied by|Payment|Subtotal|Total|Tax|Shipping|Grand Total|Amount|Balance|Terms|Qty|Quantity|Price|Unit Price|Description)$/i.test(text)) return true;
  if (/^\$?\d+(?:\.\d{2})?$/.test(text)) return true;
  if (/^\d{1,4}$/.test(text)) return true;
  if (parseAmazonDate(text)) return true;
  return false;
}

function parseGenericInvoicePdfLines(lines) {
  const dateOrdered = findInvoiceDate(lines) || todayIsoDate();
  const deliveredDate = findDeliveredDate(lines, dateOrdered);
  const invoiceNumber = findInvoiceNumber(lines);
  const itemCompany = invoiceNumber ? `Imported Invoice ${invoiceNumber}` : "Imported Invoice";
  const candidateLines = [];

  lines.forEach(line => {
    const text = normalizeRequiredText(line).replace(/\s+/g, " ");
    if (isGenericInvoiceNoiseLine(text)) return;
    if (invoiceNumber && text === invoiceNumber) return;
    if (/^\$/.test(text)) return;
    if (text.length < 4 || text.length > 180) return;
    candidateLines.push(text);
  });

  const items = candidateLines.slice(0, 60).map(line => {
    const qtyMatch = line.match(/\b(?:qty|quantity)\s*[:#]?\s*(\d+)\b/i) || line.match(/\s+x\s*(\d+)\b/i);
    const packageQty = qtyMatch ? Number(qtyMatch[1]) : 1;

    return {
      item_name: line
        .replace(/\b(?:qty|quantity)\s*[:#]?\s*\d+\b/i, "")
        .replace(/\s+x\s*\d+\b/i, "")
        .replace(/\s+\$?\d+(?:\.\d{2})?\s*$/, "")
        .replace(/\s+/g, " ")
        .trim(),
      package_qty: Number.isInteger(packageQty) && packageQty >= 0 ? packageQty : 1,
      item_supplier: "Imported PDF",
      expected_delivery_date: deliveredDate || dateOrdered,
      received_date: deliveredDate,
      received_location: deliveredDate ? "Imported PDF" : "",
      import_needs_delivery_date: deliveredDate ? 0 : 1
    };
  }).filter(item => item.item_name);

  return {
    date_ordered: dateOrdered,
    order_number: invoiceNumber,
    item_company: itemCompany,
    items
  };
}

function parseAmazonOrderPdf(buffer) {
  const lines = extractPdfTextLines(buffer)
    .filter(line =>
      !line.startsWith("https://") &&
      !line.startsWith("Page ") &&
      !["Back to top", "Conditions of Use", "Privacy Notice"].includes(line)
    );

  const orderPlacedIndex = lines.findIndex(line => /^Order placed$/i.test(line));
  const orderNumberIndex = lines.findIndex(line => /^Order #$/i.test(line));
  const inlineOrderDateLine = lines.find(line => /^Order placed\b/i.test(line));
  const dateOrdered = orderPlacedIndex >= 0
    ? parseAmazonDate(lines[orderPlacedIndex + 1])
    : parseAmazonDate(inlineOrderDateLine);
  const inlineOrderNumberLine = lines.find(line => /^Order\s*#/i.test(line));
  const orderNumber = orderNumberIndex >= 0
    ? normalizeRequiredText(lines[orderNumberIndex + 1])
    : findInlineValue(inlineOrderNumberLine, /^Order\s*#\s*(.+)$/i);
  const items = [];

  function pushAmazonItem(itemLines, supplier, expectedDeliveryDate, deliveredDate) {
    const itemName = itemLines.join(" ").replace(/\s+/g, " ").trim();
    if (!itemName) return;

    items.push({
      item_name: itemName,
      package_qty: 1,
      item_supplier: supplier || "Amazon",
      expected_delivery_date: expectedDeliveryDate || dateOrdered || todayIsoDate(),
      received_date: deliveredDate,
      received_location: deliveredDate ? "Imported PDF" : "",
      import_needs_delivery_date: expectedDeliveryDate ? 0 : 1
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!isDeliveryStatusLine(lines[index])) continue;

    const expectedDeliveryDate = parseAmazonDeliveryDate(lines[index], dateOrdered);
    const deliveredDate = isDeliveredStatusLine(lines[index]) ? expectedDeliveryDate : "";
    const itemLines = [];
    let supplier = "Amazon";
    let cursor = index + 1;

    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isDeliveryStatusLine(line)) break;
      if (/^Sold by:/i.test(line)) {
        const inlineSupplier = line.replace(/^Sold by:\s*/i, "").trim();
        supplier = inlineSupplier || normalizeRequiredText(lines[cursor + 1]) || supplier;
        pushAmazonItem(itemLines, supplier, expectedDeliveryDate, deliveredDate);
        itemLines.length = 0;
        supplier = "Amazon";
        cursor += 1;
        continue;
      }
      if (isAmazonItemNoiseLine(line)) {
        cursor += 1;
        continue;
      }
      itemLines.push(line);
      cursor += 1;
    }

    pushAmazonItem(itemLines, supplier, expectedDeliveryDate, deliveredDate);
  }

  const fallbackOrderDate = dateOrdered ||
    (items[0] && (items[0].received_date || items[0].expected_delivery_date)) ||
    todayIsoDate();

  const parsed = {
    date_ordered: fallbackOrderDate,
    order_number: orderNumber,
    item_company: orderNumber ? `Amazon Order ${orderNumber}` : "Amazon Order",
    items
  };

  if (parsed.items.length) return parsed;

  return parseGenericInvoicePdfLines(lines);
}

/* ---------- ORDERED ITEMS ---------- */
app.get("/ordered-items", (req, res) => {
  db.all(orderedItemsSelect(), [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

function orderRequestsSelect() {
  return `
    SELECT
      id,
      request_date,
      requester_name,
      department,
      item_needed,
      qty_needed,
      suggested_retailer,
      ordered_item_id,
      ordered_at,
      CASE WHEN ordered_item_id IS NULL THEN 'In Process' ELSE 'Ordered' END AS status,
      created_at,
      updated_at
    FROM order_requests
    ORDER BY
      CASE WHEN ordered_item_id IS NULL THEN 0 ELSE 1 END,
      request_date DESC,
      id DESC
  `;
}

/* ---------- ORDER REQUESTS ---------- */
app.get("/order-requests", (req, res) => {
  db.all(orderRequestsSelect(), [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.post("/order-requests", (req, res) => {
  const requestDate = normalizeRequiredText(req.body.request_date);
  const requesterName = normalizeRequiredText(req.body.requester_name);
  const department = normalizeRequiredText(req.body.department);
  const itemNeeded = normalizeRequiredText(req.body.item_needed);
  const suggestedRetailer = normalizeRequiredText(req.body.suggested_retailer);
  const qtyNeeded = Number(req.body.qty_needed);

  if (!isIsoDate(requestDate)) {
    return res.status(400).send("Valid request date is required");
  }

  if (!requesterName || !itemNeeded) {
    return res.status(400).send("Name and item needed are required");
  }

  if (!Number.isInteger(qtyNeeded) || qtyNeeded <= 0) {
    return res.status(400).send("QTY needed must be a whole number greater than zero");
  }

  db.run(
    `INSERT INTO order_requests (
       request_date,
       requester_name,
       department,
       item_needed,
       qty_needed,
       suggested_retailer,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [requestDate, requesterName, department, itemNeeded, qtyNeeded, suggestedRetailer],
    function (err) {
      if (err) return res.status(500).send(err.message);
      res.status(201).json({ message: "Order request added", id: this.lastID });
    }
  );
});

app.put("/admin/order-requests/:id/order", (req, res) => {
  const requestId = req.params.id;
  const dateOrdered = normalizeRequiredText(req.body.date_ordered);
  const expectedDeliveryDate = normalizeRequiredText(req.body.expected_delivery_date);
  const retailer = normalizeRequiredText(req.body.retailer);
  const packageQty = Number(req.body.package_qty);
  const unitsPerPackageRaw = normalizeRequiredText(req.body.units_per_package);
  const unitsPerPackage = unitsPerPackageRaw ? Number(unitsPerPackageRaw) : null;

  if (!isIsoDate(dateOrdered) || !isIsoDate(expectedDeliveryDate)) {
    return res.status(400).send("Valid ordered and expected delivery dates are required");
  }

  if (!Number.isInteger(packageQty) || packageQty <= 0) {
    return res.status(400).send("Unit-package QTY ordered must be a whole number greater than zero");
  }

  if (unitsPerPackage !== null && (!Number.isInteger(unitsPerPackage) || unitsPerPackage < 0)) {
    return res.status(400).send("Units per package must be a whole number zero or greater");
  }

  if (!retailer) {
    return res.status(400).send("Retailer is required");
  }

  db.get("SELECT * FROM order_requests WHERE id = ?", [requestId], (selectErr, request) => {
    if (selectErr) return res.status(500).send(selectErr.message);
    if (!request) return res.status(404).send("Order request not found");
    if (request.ordered_item_id) return res.status(400).send("Order request is already marked ordered");

    db.run(
      `INSERT INTO ordered_items (
         date_ordered,
         expected_delivery_date,
         item_name,
         item_company,
         package_qty,
         units_per_package,
         item_supplier,
         department,
         request_id,
         requested_by,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        dateOrdered,
        expectedDeliveryDate,
        request.item_needed,
        request.requester_name,
        packageQty,
        unitsPerPackage,
        retailer,
        request.department || "",
        request.id,
        request.requester_name
      ],
      function (insertErr) {
        if (insertErr) return res.status(500).send(insertErr.message);

        const orderedItemId = this.lastID;
        db.run(
          `UPDATE order_requests
           SET ordered_item_id = ?,
               ordered_at = datetime('now'),
               updated_at = datetime('now')
           WHERE id = ?`,
          [orderedItemId, request.id],
          updateErr => {
            if (updateErr) return res.status(500).send(updateErr.message);
            res.json({
              message: "Order request marked ordered",
              ordered_item_id: orderedItemId
            });
          }
        );
      }
    );
  });
});

app.post("/admin/ordered-items", async (req, res) => {
  const dateOrdered = normalizeRequiredText(req.body.date_ordered);
  const expectedDeliveryDate = normalizeRequiredText(req.body.expected_delivery_date);
  const itemCompany = normalizeRequiredText(req.body.item_company) || "Manual Entry";
  const itemSupplier = normalizeRequiredText(req.body.item_supplier);
  const department = normalizeRequiredText(req.body.department);
  const items = Array.isArray(req.body.items)
    ? req.body.items.map(item => ({
        itemName: normalizeRequiredText(item && item.item_name),
        packageQty: Number(item && item.package_qty)
      }))
    : [{
        itemName: normalizeRequiredText(req.body.item_name),
        packageQty: Number(req.body.package_qty)
      }];

  if (!isIsoDate(dateOrdered) || !isIsoDate(expectedDeliveryDate)) {
    return res.status(400).send("Valid ordered and expected delivery dates are required");
  }

  if (!itemSupplier || !department) {
    return res.status(400).send("Supplier and department are required");
  }

  if (!items.length || items.some(item => !item.itemName)) {
    return res.status(400).send("Item name, supplier, and department are required");
  }

  if (items.some(item => !Number.isInteger(item.packageQty) || item.packageQty < 0)) {
    return res.status(400).send("Package QTY must be a whole number zero or greater");
  }

  const insertSql =
    `INSERT INTO ordered_items (
       date_ordered,
       expected_delivery_date,
       item_name,
       item_company,
       package_qty,
       item_supplier,
       department,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

  try {
    const ids = await withTransaction(async transaction => {
      const insertedIds = [];

      for (const item of items) {
        const result = await runSql(insertSql, [
          dateOrdered,
          expectedDeliveryDate,
          item.itemName,
          itemCompany,
          item.packageQty,
          itemSupplier,
          department
        ], transaction);
        insertedIds.push(result.lastID);
      }

      return insertedIds;
    });

    res.status(201).json({ message: "Ordered delivery added", ids });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

async function importOrderedItemsPdf(req, res) {
  const department = normalizeRequiredText(req.query.department || req.headers["x-order-department"]);

  if (!department) {
    return res.status(400).send("Department is required for imported order items");
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).send("Upload a PDF order details file");
  }

  const parsed = parseAmazonOrderPdf(req.body);
  if (!isIsoDate(parsed.date_ordered) || !parsed.items.length) {
    return res.status(400).send("Could not find ordered items in this PDF");
  }

  const insertSql =
    `INSERT INTO ordered_items (
       date_ordered,
       expected_delivery_date,
       item_name,
       item_company,
       package_qty,
       item_supplier,
       department,
       received_date,
       received_location,
       import_needs_delivery_date,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

  try {
    const itemCompany = parsed.item_company || (parsed.order_number ? `Amazon Order ${parsed.order_number}` : "Imported PDF");
    const ids = await withTransaction(async transaction => {
      const insertedIds = [];

      for (const item of parsed.items) {
        const needsDeliveryDate = item.import_needs_delivery_date ? 1 : 0;
        const receivedDate = isIsoDate(item.received_date) ? item.received_date : null;
        const result = await runSql(insertSql, [
          parsed.date_ordered,
          item.expected_delivery_date,
          item.item_name,
          itemCompany,
          item.package_qty,
          item.item_supplier,
          department,
          receivedDate,
          receivedDate ? item.received_location || "Imported PDF" : null,
          needsDeliveryDate
        ], transaction);
        insertedIds.push(result.lastID);
      }

      return insertedIds;
    });

    res.status(201).json({
      message: "Order PDF imported",
      ids,
      date_ordered: parsed.date_ordered,
      order_number: parsed.order_number,
      needs_delivery_date: parsed.items.filter(item => item.import_needs_delivery_date).length,
      received: parsed.items.filter(item => item.received_date).length,
      items: parsed.items
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
}

app.post("/ordered-items/import-pdf", express.raw({ type: "application/pdf", limit: "10mb" }), importOrderedItemsPdf);
app.post("/admin/ordered-items/import-pdf", express.raw({ type: "application/pdf", limit: "10mb" }), importOrderedItemsPdf);

app.post("/ordered-items/received", (req, res) => {
  const dateOrdered = normalizeRequiredText(req.body.date_ordered);
  const expectedDeliveryDate = normalizeRequiredText(req.body.expected_delivery_date);
  const itemName = normalizeRequiredText(req.body.item_name);
  const itemCompany = normalizeRequiredText(req.body.item_company) || "Manual Received Entry";
  const itemSupplier = normalizeRequiredText(req.body.item_supplier);
  const department = normalizeRequiredText(req.body.department);
  const receivedDate = normalizeRequiredText(req.body.received_date);
  const receivedTime = normalizeRequiredText(req.body.received_time);
  const receivedLocation = normalizeRequiredText(req.body.received_location);
  const packageQty = Number(req.body.package_qty);
  const unitsPerPackageRaw = normalizeRequiredText(req.body.units_per_package);
  const unitsPerPackage = unitsPerPackageRaw ? Number(unitsPerPackageRaw) : null;

  if (!isIsoDate(dateOrdered) || !isIsoDate(expectedDeliveryDate) || !isIsoDate(receivedDate)) {
    return res.status(400).send("Valid ordered, expected delivery, and received dates are required");
  }

  if (receivedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(receivedTime)) {
    return res.status(400).send("Received time must use HH:MM format");
  }

  if (!itemName || !itemSupplier || !department || !receivedLocation) {
    return res.status(400).send("Item name, supplier, department, and received location are required");
  }

  if (!Number.isInteger(packageQty) || packageQty < 0) {
    return res.status(400).send("Package QTY must be a whole number zero or greater");
  }

  if (unitsPerPackage !== null && (!Number.isInteger(unitsPerPackage) || unitsPerPackage < 0)) {
    return res.status(400).send("Units per package must be a whole number zero or greater");
  }

  db.run(
    `INSERT INTO ordered_items (
       date_ordered,
       expected_delivery_date,
       item_name,
       item_company,
       package_qty,
       units_per_package,
       item_supplier,
       department,
       requested_by,
       received_date,
       received_time,
       received_location,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      dateOrdered,
      expectedDeliveryDate,
      itemName,
      itemCompany,
      packageQty,
      unitsPerPackage,
      itemSupplier,
      department,
      itemCompany,
      receivedDate,
      receivedTime || null,
      receivedLocation
    ],
    function (err) {
      if (err) return res.status(500).send(err.message);
      res.status(201).json({ message: "Received item added", id: this.lastID });
    }
  );
});

app.put("/ordered-items/:id/receive", (req, res) => {
  const receivedDate = normalizeRequiredText(req.body.received_date);
  const receivedTime = normalizeRequiredText(req.body.received_time);
  const receivedLocation = normalizeRequiredText(req.body.received_location);

  if (!isIsoDate(receivedDate)) {
    return res.status(400).send("Valid received date is required");
  }

  if (receivedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(receivedTime)) {
    return res.status(400).send("Received time must use HH:MM format");
  }

  if (!receivedLocation) {
    return res.status(400).send("Received location is required");
  }

  db.run(
    `UPDATE ordered_items
     SET received_date = ?,
         received_time = ?,
         received_location = ?,
         import_needs_delivery_date = 0,
         updated_at = datetime('now')
     WHERE id = ?`,
    [receivedDate, receivedTime || null, receivedLocation, req.params.id],
    function (err) {
      if (err) return res.status(500).send(err.message);
      if (this.changes === 0) return res.status(404).send("Ordered item not found");
      res.json({ message: "Ordered item received" });
    }
  );
});

app.put("/ordered-items/:id/undo-receive", (req, res) => {
  db.run(
    `UPDATE ordered_items
     SET received_date = NULL,
         received_time = NULL,
         received_location = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [req.params.id],
    function (err) {
      if (err) return res.status(500).send(err.message);
      if (this.changes === 0) return res.status(404).send("Ordered item not found");
      res.json({ message: "Ordered item moved back to expected deliveries" });
    }
  );
});

/* ---------- START TIMER ---------- */
app.post("/start", (req, res) => {
  const { item_id, task_id, employee, work_date } = req.body;
  const dispensaryName = normalizeRequiredText(req.body.dispensary_name);

  if (!employee || !work_date) {
    return res.status(400).send("Employee and date are required");
  }

  db.run(
    `INSERT INTO time_logs (item_id, task_id, employee, work_date, start_time, paused_seconds, dispensary_name)
     VALUES (?, ?, ?, ?, datetime('now'), 0, ?)`,
    [item_id || null, task_id || null, employee, work_date, dispensaryName || null],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }

      db.get(
        `SELECT id AS log_id,
                start_time,
                strftime('%s', start_time) AS start_epoch
         FROM time_logs
         WHERE id = ?`,
        [this.lastID],
        (selectErr, row) => {
          if (selectErr) {
            console.error(selectErr);
            return res.status(500).send(selectErr.message);
          }

          res.json(row);
        }
      );
    }
  );
});

function timerStateSelect(whereClause) {
  return `
    SELECT
      l.id AS log_id,
      l.item_id,
      l.task_id,
      l.employee,
      l.work_date,
      l.start_time,
      l.end_time,
      l.duration_seconds,
      COALESCE(l.paused_seconds, 0) AS paused_seconds,
      l.pause_started_at,
      COALESCE(l.dispensary_name, '') AS dispensary_name,
      l.quantity,
      strftime('%s', l.start_time) AS start_epoch,
      strftime('%s', l.pause_started_at) AS pause_started_epoch,
      CASE
        WHEN l.end_time IS NOT NULL THEN COALESCE(l.duration_seconds, 0)
        WHEN l.pause_started_at IS NOT NULL THEN
          strftime('%s', l.pause_started_at) - strftime('%s', l.start_time) - COALESCE(l.paused_seconds, 0)
        ELSE
          strftime('%s', 'now') - strftime('%s', l.start_time) - COALESCE(l.paused_seconds, 0)
      END AS elapsed_seconds,
      COALESCE(i.name, 'Unknown Item') AS item,
      COALESCE(t.name, 'Unknown Task') AS task
    FROM time_logs l
    LEFT JOIN items i ON i.id = l.item_id
    LEFT JOIN tasks t ON t.id = l.task_id
    ${whereClause}
  `;
}

/* ---------- TIMER STATE ---------- */
app.get("/timer-state/:id", (req, res) => {
  db.get(timerStateSelect("WHERE l.id = ?"), [req.params.id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    if (!row) return res.status(404).send("Timer not found");

    res.json(row);
  });
});

app.get("/active-timer", (req, res) => {
  const { employee, work_date } = req.query;

  if (!employee || !work_date) {
    return res.status(400).send("Employee and date are required");
  }

  db.get(
    timerStateSelect(`
      WHERE l.employee = ?
      AND l.work_date = ?
      AND l.quantity IS NULL
      ORDER BY l.id DESC
      LIMIT 1
    `),
    [employee, work_date],
    (err, row) => {
      if (err) return res.status(500).send(err.message);
      if (!row) return res.status(204).end();

      res.json(row);
    }
  );
});

/* ---------- PAUSE TIMER ---------- */
app.post("/pause", (req, res) => {
  const { log_id } = req.body;

  if (!log_id) {
    return res.status(400).send("Missing log_id");
  }

  db.get(timerStateSelect("WHERE l.id = ?"), [log_id], (stateErr, current) => {
    if (stateErr) return res.status(500).send(stateErr.message);
    if (!current) return res.status(404).send("Timer not found");
    if (current.end_time) return res.status(400).send("Timer is already stopped");
    if (current.pause_started_at) return res.status(400).send("Timer is already paused");

    db.run(
      `UPDATE time_logs
       SET pause_started_at = datetime('now')
       WHERE id = ?
       AND end_time IS NULL
       AND pause_started_at IS NULL`,
      [log_id],
      err => {
        if (err) return res.status(500).send(err.message);

        db.get(timerStateSelect("WHERE l.id = ?"), [log_id], (selectErr, row) => {
          if (selectErr) return res.status(500).send(selectErr.message);
          if (!row || !row.pause_started_at) {
            return res.status(400).send("Timer could not be paused");
          }
          res.json(row);
        });
      }
    );
  });
});

function secondsSinceNowSql(columnName) {
  return `strftime('%s','now') - strftime('%s', ${columnName})`;
}

function resumeTimer(logId, res) {
  db.get(timerStateSelect("WHERE l.id = ?"), [logId], (stateErr, current) => {
    if (stateErr) return res.status(500).send(stateErr.message);
    if (!current) return res.status(404).send("Timer not found");
    if (current.end_time) return res.status(400).send("Timer is already stopped");
    if (!current.pause_started_at) return res.status(400).send("Timer is not paused");

    db.run(
      `UPDATE time_logs
       SET paused_seconds = COALESCE(paused_seconds, 0) + ${secondsSinceNowSql("pause_started_at")},
           pause_started_at = NULL
       WHERE id = ?
       AND end_time IS NULL
       AND pause_started_at IS NOT NULL`,
      [logId],
      err => {
        if (err) return res.status(500).send(err.message);

        db.get(timerStateSelect("WHERE l.id = ?"), [logId], (selectErr, row) => {
          if (selectErr) return res.status(500).send(selectErr.message);
          if (!row || row.pause_started_at) {
            return res.status(400).send("Timer could not be resumed");
          }
          res.json(row);
        });
      }
    );
  });
}

/* ---------- RESUME TIMER ---------- */
app.post("/resume", (req, res) => {
  const { log_id } = req.body;

  if (!log_id) {
    return res.status(400).send("Missing log_id");
  }

  resumeTimer(log_id, res);
});

/* ---------- LEGACY RESUME TIMER ---------- */
app.post("/restart", (req, res) => {
  const { log_id } = req.body;

  if (!log_id) {
    return res.status(400).send("Missing log_id");
  }

  resumeTimer(log_id, res);
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
         duration_seconds =
           CASE
             WHEN pause_started_at IS NOT NULL THEN
               strftime('%s', pause_started_at) - strftime('%s', start_time) - COALESCE(paused_seconds, 0)
             ELSE
               strftime('%s','now') - strftime('%s', start_time) - COALESCE(paused_seconds, 0)
           END,
         pause_started_at = NULL
     WHERE id = ?
     AND end_time IS NULL`,
    [log_id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      if (this.changes === 0) {
        return res.status(400).send("Timer already stopped or invalid log_id");
      }

      db.get(
        `SELECT id AS log_id, duration_seconds
         FROM time_logs
         WHERE id = ?`,
        [log_id],
        (selectErr, row) => {
          if (selectErr) return res.status(500).send(selectErr.message);
          res.json({ message: "Stopped", ...row });
        }
      );
    }
  );
});

/* ---------- UPDATE QTY ---------- */
app.post("/update-qty", (req, res) => {
  let { log_id, item_id, task_id, quantity } = req.body;
  const dispensaryName = normalizeRequiredText(req.body.dispensary_name);

  if (!log_id) {
    return res.status(400).send("Missing log_id");
  }

  item_id = Number(item_id);
  task_id = Number(task_id);

  if (!Number.isInteger(item_id) || !Number.isInteger(task_id) || item_id <= 0 || task_id <= 0) {
    return res.status(400).send("Item and task are required");
  }

  quantity = parseInt(quantity);
  if (isNaN(quantity)) {
    return res.status(400).send("Invalid quantity");
  }

  db.run(
    `UPDATE time_logs
     SET item_id = ?,
         task_id = ?,
         quantity = ?,
         dispensary_name = ?
     WHERE id = ?
     AND end_time IS NOT NULL`,
    [item_id, task_id, quantity, dispensaryName || null, log_id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      if (this.changes === 0) {
        return res.status(400).send("Stop timer before setting quantity");
      }

      res.json({ message: "Quantity updated" });
    }
  );
});

/* ---------- ADMIN ENTRIES ---------- */
app.get("/admin/entries", (req, res) => {
  db.all(`
    SELECT
      l.id AS log_id,
      l.item_id,
      l.task_id,
      COALESCE(l.dispensary_name, '') AS dispensary_name,
      COALESCE(i.name, 'Unknown Item') AS item,
      COALESCE(t.name, 'Unknown Task') AS task,
      l.employee,
      l.work_date,
      CASE
        WHEN l.work_date < '2026-05-21' THEN 'test data'
        ELSE 'live'
      END AS data_status,
      COALESCE(l.quantity, 0) AS quantity,
      COALESCE(l.duration_seconds, 0) AS duration_seconds,
      CASE
        WHEN COALESCE(l.quantity, 0) = 0 THEN 0
        ELSE COALESCE(l.duration_seconds, 0) / COALESCE(l.quantity, 0)
      END AS sec_per_unit
    FROM time_logs l
    LEFT JOIN items i ON i.id = l.item_id
    LEFT JOIN tasks t ON t.id = l.task_id
    WHERE l.end_time IS NOT NULL
    ORDER BY l.work_date DESC, l.id DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.put("/admin/entries/:id", (req, res) => {
  const { employee, work_date } = req.body;
  let { item_id, task_id } = req.body;
  let { quantity, duration_seconds } = req.body;
  const dispensaryName = normalizeRequiredText(req.body.dispensary_name);

  if (!employee || !work_date || !item_id || !task_id) {
    return res.status(400).send("Employee, date, item, and task are required");
  }

  item_id = Number(item_id);
  task_id = Number(task_id);
  quantity = Number(quantity);
  duration_seconds = Number(duration_seconds);

  if (!Number.isInteger(item_id) || !Number.isInteger(task_id)) {
    return res.status(400).send("Invalid item or task");
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).send("Quantity must be a whole number zero or greater");
  }

  if (!Number.isInteger(duration_seconds) || duration_seconds < 0) {
    return res.status(400).send("Time must be a whole number zero or greater");
  }

  db.run(
    `UPDATE time_logs
     SET item_id = ?,
         task_id = ?,
         employee = ?,
         work_date = ?,
         quantity = ?,
         duration_seconds = ?,
         dispensary_name = ?
     WHERE id = ?
     AND end_time IS NOT NULL`,
    [item_id, task_id, employee, work_date, quantity, duration_seconds, dispensaryName || null, req.params.id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      if (this.changes === 0) {
        return res.status(404).send("Completed entry not found");
      }

      res.json({ message: "Entry updated" });
    }
  );
});

app.delete("/admin/entries/:id", (req, res) => {
  db.run(
    `DELETE FROM time_logs
     WHERE id = ?
     AND end_time IS NOT NULL`,
    [req.params.id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      if (this.changes === 0) {
        return res.status(404).send("Completed entry not found");
      }

      res.json({ message: "Entry deleted" });
    }
  );
});

app.get("/admin/database-status", async (req, res) => {
  try {
    const [entryCountRows, incompleteRows] = await Promise.all([
      allSql("SELECT COUNT(*) AS count FROM time_logs"),
      allSql("SELECT COUNT(*) AS count FROM time_logs WHERE quantity IS NULL")
    ]);

    res.json({
      database: db.info || { provider: "unknown" },
      time_logs: Number(entryCountRows[0] && entryCountRows[0].count) || 0,
      incomplete_time_logs: Number(incompleteRows[0] && incompleteRows[0].count) || 0
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
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
      CASE
        WHEN l.work_date < '2026-05-21' THEN 'test data'
        ELSE 'live'
      END AS data_status,
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
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Running on port " + PORT);
    });
  })
  .catch(err => {
    console.error("DATABASE INITIALIZATION ERROR:", err.message);
    process.exit(1);
  });
