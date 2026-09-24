const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');

test('editing an imported item clears its needs-date flag only after a valid save', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE ordered_items (id INTEGER PRIMARY KEY, date_ordered TEXT,
    expected_delivery_date TEXT, import_needs_delivery_date INTEGER, item_name TEXT,
    item_company TEXT, package_qty INTEGER, units_per_package INTEGER, item_supplier TEXT,
    department TEXT, updated_at TEXT);
    INSERT INTO ordered_items (id, import_needs_delivery_date) VALUES (1, 1), (2, 1);`);
  let handler;
  const source = fs.readFileSync('server.js', 'utf8');
  vm.runInNewContext(source.slice(source.indexOf('app.put("/ordered-items/:id",'), source.indexOf('app.put("/ordered-items/:id/expected-date"')), {
    app: { put: (path, fn) => handler = fn },
    normalizeRequiredText: value => String(value ?? '').trim(),
    isIsoDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
    db: { run(sql, args, callback) {
      try { callback.call(database.prepare(sql).run(...args), null); }
      catch (err) { callback(err); }
    } }
  });
  const payload = { date_ordered: '2026-09-21', expected_delivery_date: '2026-09-25',
    item_name: 'Boxes', item_supplier: 'Supplier', department: 'Kitchen', package_qty: 3 };
  function save(body, id = '1') {
    let status = 200;
    handler({ params: { id }, body }, { status(value) { status = value; return this; }, send() {}, json() {} });
    return status;
  }
  assert.equal(save({ ...payload, expected_delivery_date: '' }), 400);
  assert.equal(database.prepare('SELECT import_needs_delivery_date AS flag FROM ordered_items WHERE id = 1').get().flag, 1);
  assert.equal(save(payload), 200);
  const row = database.prepare('SELECT * FROM ordered_items WHERE id = 1').get();
  assert.equal(row.expected_delivery_date, '2026-09-25');
  assert.equal(row.import_needs_delivery_date, 0);
  assert.equal(database.prepare('SELECT import_needs_delivery_date AS flag FROM ordered_items WHERE id = 2').get().flag, 1);
  assert.equal(save(payload, '999'), 404);
  database.close();
});
