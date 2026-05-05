const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data/database.sqlite");

db.serialize(() => {
  // Create base tables
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

  // 🔥 ADD MISSING COLUMNS (this fixes your issue permanently)
  db.run(`ALTER TABLE time_logs ADD COLUMN employee TEXT`, () => {});
  db.run(`ALTER TABLE time_logs ADD COLUMN work_date TEXT`, () => {});

  // Seed items (only if empty)
  db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO items (name) VALUES 
        ('Daytime Focus Micro Pump'),
        ('Good Night Sleep Micro Pump'),
        ('Main Squeeze Party Pouch'),
        ('Micro Dots (50-piece packs)'),
        ('RSO Whoopie Hi'),
        ('Space Chunk OG 1 chunk (pcs)'),
        ('Space Chunk ALPHA OG 2 chunk (units)'),
        ('Space Chunk REX OG 2 chunk (units)'),
        ('Space Chunk ZUUL OG 2 chunk (units)'),
        ('Space Chunk 1 chunk CBD 50mg 1-1 (pcs)'),
        ('Space Chunks CBD 2 chunks 1-1 (units)'),
        ('Space Chunk CBN 1 chunk (pcs)'),
        ('Space Chunk CBN 2 chunk (units)'),
        ('Space Chunk Mini 10 chunk (units)'),
        ('Space Chunk SUGAR FREE'),
        ('Shooters Triple Citrus'),
        ('Shooters Sour Watermelon'),
        ('Shooters Sour Blu Raz'),
        ('Grape 1g'),
        ('Mango 1g'),
        ('Lemon 1g'),
        ('Strawberry Dragonfruit 1g'),
        ('Peach Passion Fruit 1g'),
        ('Cherry Pomegranate Lemon 1g'),
        ('Watermelon 1g'),
        ('Big Stick'),
        ('Small Stick'),
        ('Tiny Stick'),
        ('Lube 2oz'),
        ('Lube 1oz'),
        ('Lotion 4oz'),
        ('Lotion 1oz'),
        ('Romance Oil')
      `);
    }
  });

  // Seed tasks (only if empty)
  db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO tasks (name) VALUES 
        ('Filling 1g (SB)'),
        ('Filling 2g (SB)'),
        ('Capping (SB)'),
        ('Cooking'),
        ('Depositing (Truffly)'),
        ('Depositing (Slot Machine)'),
        ('Depositing (Filling Machine)'),
        ('Capping (Shooters)'),
        ('TR Stickering (Shooters)'),
        ('Cleaning'),
        ('Prepping Molds'),
        ('Candy Bits Shaking'),
        ('Popping'),
        ('Sugaring'),
        ('Packaging (1pc)'),
        ('Packaging (2pc)'),
        ('Packaging (10pc)'),
        ('Packaging (50pc)'),
        ('Packaging (3pc)'),
        ('Sealing (Hijnx)'),
        ('Sealing/Packaging (SB)'),
        ('Counting (Hijnx)'),
        ('Counting (SB)'),
        ('Exit Stickering (Hijnx)'),
        ('Exit Stickering (SB)'),
        ('Making Exit Labels (Hijnx)'),
        ('Making Exit Labels (SB)')
      `);
    }
  });
});

module.exports = db;