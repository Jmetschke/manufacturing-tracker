const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { createCalendarStore, revision } = require('../server/calendar-store');
function setup() {
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE schedule_days(schedule_date TEXT PRIMARY KEY, tasks TEXT, updated_at TEXT)');
  const store = createCalendarStore({ database,
    getSql: async (sql, args, db) => db.prepare(sql).get(...args),
    runSql: async (sql, args, db) => db.prepare(sql).run(...args) });
  return { store, database };
}
test('stale editors and older clients cannot overwrite a day', async () => {
  const { store, database } = setup();
  const first = await store.save('2026-09-21', 'missing', () => '{"events":[]}');
  await store.save('2026-09-21', first.revision, () => '{"events":[],"note":"new"}');
  await assert.rejects(store.save('2026-09-21', first.revision, () => 'stale'), { status: 409 });
  await assert.rejects(store.save('2026-09-21', undefined, () => 'unversioned'), { status: 428 });
  assert.match((await store.read('2026-09-21')).tasks, /new/);
  database.close();
});
test('simultaneous creation and simultaneous edits allow only one winner', async () => {
  const { store, database } = setup();
  for (const version of ['missing', null]) {
    const base = version || revision(await store.read('2026-09-21'));
    let release; const barrier = new Promise(resolve => release = resolve); let arrived = 0;
    const transform = async value => { if (++arrived === 2) release(); await barrier; return value; };
    const results = await Promise.allSettled([
      store.save('2026-09-21', base, () => transform(`first-${version}`)),
      store.save('2026-09-21', base, () => transform(`second-${version}`))
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  }
  database.close();
});
test('task completion retries on latest content and preserves other edits', async () => {
  const { store, database } = setup();
  await store.save('2026-09-21', 'missing', () => JSON.stringify({ title: 'before', done: false, events: [{ id: 'stable', outlookEventId: 'external' }] }));
  let calls = 0;
  await store.update('2026-09-21', async row => {
    if (++calls === 1) await store.save('2026-09-21', revision(row), () => JSON.stringify({ ...JSON.parse(row.tasks), title: 'other user' }));
    return JSON.stringify({ ...JSON.parse(row.tasks), done: true });
  });
  const saved = JSON.parse((await store.read('2026-09-21')).tasks);
  assert.equal(calls, 2); assert.equal(saved.title, 'other user'); assert.equal(saved.done, true);
  assert.equal(saved.events[0].outlookEventId, 'external');
  database.close();
});
test('external writes are detected even when updated_at does not change', async () => {
  const { store, database } = setup();
  const first = await store.save('2026-09-21', 'missing', () => 'first');
  database.prepare('UPDATE schedule_days SET tasks = ?').run('external');
  await assert.rejects(store.save('2026-09-21', first.revision, () => 'stale'), { status: 409 });
  database.close();
});
