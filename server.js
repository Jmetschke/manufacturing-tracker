console.log("SERVER ACTIVE - CORRECT FILE");

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");
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
  "Swag"
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
  "Swag Counting"
];

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function allSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function addMissingColumn(table, column, definition) {
  const columns = await allSql(`PRAGMA table_info(${table})`);
  const exists = columns.some(c => c.name === column);
  if (exists) return false;

  await runSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
    testPickups: []
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
        testPickups: Array.isArray(parsed.testPickups) ? parsed.testPickups : []
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
    await runSql(
      "UPDATE schedule_days SET tasks = ?, updated_at = datetime('now') WHERE schedule_date = ?",
      [JSON.stringify(payload), row.schedule_date]
    );
    console.log(`Removed weekend calendar tasks from ${row.schedule_date}`);
  }
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
      quantity INTEGER
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS schedule_days (
      schedule_date TEXT PRIMARY KEY,
      tasks TEXT DEFAULT '',
      updated_at TEXT
    )
  `);

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
  await clearWeekendScheduleTasks();

  await seedNames("items", itemNames);
  await removeNames("items", ["Item A", "Item B"]);
  await seedNames("tasks", taskNames);
  await removeNames("tasks", ["Assembly"]);
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

  db.run(
    `INSERT INTO schedule_days (schedule_date, tasks, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(schedule_date) DO UPDATE SET
       tasks = excluded.tasks,
       updated_at = excluded.updated_at`,
    [scheduleDate, savedTasks],
    function (err) {
      if (err) return res.status(500).send(err.message);
      res.json({ message: "Schedule updated", schedule_date: scheduleDate, tasks: savedTasks });
    }
  );
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
    await runSql("BEGIN TRANSACTION");
    const ids = [];

    for (const item of items) {
      const result = await runSql(insertSql, [
        dateOrdered,
        expectedDeliveryDate,
        item.itemName,
        itemCompany,
        item.packageQty,
        itemSupplier,
        department
      ]);
      ids.push(result.lastID);
    }

    await runSql("COMMIT");
    res.status(201).json({ message: "Ordered delivery added", ids });
  } catch (err) {
    try {
      await runSql("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr.message);
    }
    res.status(500).send(err.message);
  }
});

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

  if (!employee || !work_date) {
    return res.status(400).send("Employee and date are required");
  }

  if (!item_id || !task_id) {
    return res.status(400).send("Item and task are required");
  }

  db.run(
    `INSERT INTO time_logs (item_id, task_id, employee, work_date, start_time, paused_seconds)
     VALUES (?, ?, ?, ?, datetime('now'), 0)`,
    [item_id, task_id, employee, work_date],
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

/* ---------- ADMIN ENTRIES ---------- */
app.get("/admin/entries", (req, res) => {
  db.all(`
    SELECT
      l.id AS log_id,
      l.item_id,
      l.task_id,
      COALESCE(i.name, 'Unknown Item') AS item,
      COALESCE(t.name, 'Unknown Task') AS task,
      l.employee,
      l.work_date,
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
         duration_seconds = ?
     WHERE id = ?
     AND end_time IS NOT NULL`,
    [item_id, task_id, employee, work_date, quantity, duration_seconds, req.params.id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      if (this.changes === 0) {
        return res.status(404).send("Completed entry not found");
      }

      res.json({ message: "Entry updated" });
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
