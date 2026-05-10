const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach(line => {
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

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function normalizeValue(value) {
  if (typeof value !== "bigint") return value;

  if (
    value <= BigInt(Number.MAX_SAFE_INTEGER) &&
    value >= BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return Number(value);
  }

  return value.toString();
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])
  );
}

function createTursoDatabase(url, authToken) {
  const { createClient } = require("@libsql/client");
  const client = createClient({ url, authToken });

  console.log("Connected to Turso database:", url);

  return {
    run(sql, params = [], callback = () => {}) {
      client.execute({ sql, args: params })
        .then(result => {
          const context = {
            lastID: normalizeValue(result.lastInsertRowid),
            changes: Number(result.rowsAffected || 0)
          };

          callback.call(context, null);
        })
        .catch(err => callback(err));
    },

    all(sql, params = [], callback = () => {}) {
      client.execute({ sql, args: params })
        .then(result => callback(null, result.rows.map(normalizeRow)))
        .catch(err => callback(err));
    },

    get(sql, params = [], callback = () => {}) {
      client.execute({ sql, args: params })
        .then(result => {
          const row = result.rows[0] ? normalizeRow(result.rows[0]) : undefined;
          callback(null, row);
        })
        .catch(err => callback(err));
    }
  };
}

function createLocalDatabase() {
  const sqlite3 = require("sqlite3").verbose();
  const dataDir = path.join(__dirname, "data");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  const dbPath = path.join(dataDir, "database.sqlite");

  return new sqlite3.Database(dbPath, err => {
    if (err) {
      console.error("DATABASE OPEN ERROR:", err.message);
    } else {
      console.log("Connected to local SQLite database:", dbPath);
    }
  });
}

loadEnvFile();

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_DATABASE_TOKEN;

module.exports = tursoUrl && tursoToken
  ? createTursoDatabase(tursoUrl, tursoToken)
  : createLocalDatabase();
