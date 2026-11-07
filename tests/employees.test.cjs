const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const createEmployees = require('../server/employees');

test('employee choices persist deletion, allow reactivation, and leave history intact', async () => {
  const db = new DatabaseSync(':memory:');
  const service = createEmployees({
    runSql: async (sql, args = []) => db.prepare(sql).run(...args),
    allSql: async (sql, args = []) => db.prepare(sql).all(...args)
  });
  try {
    await service.initialize();
    assert.equal((await service.list()).length, 16);
    db.exec("CREATE TABLE time_logs(employee TEXT); INSERT INTO time_logs VALUES ('Wayne')");
    const wayne = (await service.list()).find(row => row.name === 'Wayne');
    await service.remove(wayne.id);
    await service.initialize();
    assert.equal((await service.list()).some(row => row.name === 'Wayne'), false);
    assert.equal(db.prepare('SELECT employee FROM time_logs').get().employee, 'Wayne');
    await service.add(' wayne ');
    assert.equal((await service.list()).filter(row => row.name.toLowerCase() === 'wayne').length, 1);
    await service.add('  New   Person  ');
    await service.add('new person');
    assert.equal((await service.list()).filter(row => row.name === 'New Person').length, 1);
    await service.add("O'Brien");
    assert.ok((await service.list()).some(row => row.name === "O'Brien"));
    for (const value of ['', '   ', null, 22, 'x'.repeat(101)]) {
      await assert.rejects(service.add(value), { status: 400 });
    }
    await assert.rejects(service.remove('bad'), { status: 400 });
    for (const row of await service.list()) await service.remove(row.id);
    await service.initialize();
    assert.equal((await service.list()).length, 0);
  } finally { db.close(); }
});
