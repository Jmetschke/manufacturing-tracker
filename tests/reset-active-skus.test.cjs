const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const reset = require('../server/reset-active-skus');

const tables = ['active_skus', 'active_sku_selections', 'active_sku_withholdings',
  'deleted_active_skus', 'active_sku_import_settings', 'items', 'item_metrc_names', 'ordered_items'];
function setup() {
  const db = new DatabaseSync(':memory:');
  for (const table of tables) db.exec(`CREATE TABLE ${table}(id INTEGER); INSERT INTO ${table} VALUES(1)`);
  const helpers = {
    runSql: async (sql, args = []) => db.prepare(sql).run(...args),
    getSql: async (sql, args = []) => db.prepare(sql).get(...args),
    withTransaction: async fn => {
      db.exec('BEGIN');
      try { await fn(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  };
  return { db, helpers, count: table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n };
}
test('reset clears only SKU data once and preserves production and order records', async () => {
  const { db, helpers, count } = setup();
  try {
    await reset(helpers);
    for (const table of tables.slice(0, 5)) assert.equal(count(table), 0, table);
    for (const table of tables.slice(5)) assert.equal(count(table), 1, table);
    db.exec('INSERT INTO active_skus VALUES(2)');
    await reset(helpers);
    assert.equal(count('active_skus'), 1);
    assert.equal(count('application_migrations'), 1);
  } finally { db.close(); }
});
test('a failed reset rolls back all deletions and can be retried', async () => {
  const { db, helpers, count } = setup();
  try {
    await assert.rejects(reset({ ...helpers, runSql: async (sql, args) => {
      if (sql === 'DELETE FROM active_skus') throw new Error('test failure');
      return helpers.runSql(sql, args);
    }}), /test failure/);
    for (const table of tables) assert.equal(count(table), 1, table);
    assert.equal(count('application_migrations'), 0);
    await reset(helpers);
    assert.equal(count('active_skus'), 0);
  } finally { db.close(); }
});
