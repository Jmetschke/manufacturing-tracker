const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const move = require('../server/move-calendar-event');
const { revision } = require('../server/calendar-store');
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE schedule_days(schedule_date TEXT PRIMARY KEY, tasks TEXT, updated_at TEXT)');
  const event = { id: 'event-1', date: '2026-11-09', title: 'Training', days: 3, times: [{ start: '09:00', end: '10:00' }], location: 'Office', company: 'Hijnx', externalId: 'keep-me' };
  const source = { events: [event, { id: 'other' }], tasks: [{ title: 'Keep source task' }] };
  const target = { events: [{ id: 'target-event' }], batchHijnx: [{ item: 'Keep batch' }] };
  const put = (date, value) => db.prepare('INSERT INTO schedule_days VALUES (?, ?, NULL)').run(date, JSON.stringify(value));
  put('2026-11-09', source); put('2026-11-14', target);
  const read = date => db.prepare('SELECT * FROM schedule_days WHERE schedule_date = ?').get(date);
  const deps = { database: db,
    getSql: async (sql, args, database) => database.prepare(sql).get(...args),
    runSql: async (sql, args, database) => database.prepare(sql).run(...args),
    withTransaction: async fn => { db.exec('BEGIN'); try { const result = await fn(db); db.exec('COMMIT'); return result; } catch (err) { db.exec('ROLLBACK'); throw err; } }
  };
  const input = { sourceDate: '2026-11-09', targetDate: '2026-11-14', eventId: event.id, sourceRevision: revision(read('2026-11-09')), targetRevision: revision(read('2026-11-14')) };
  return { db, event, source, target, read, deps, input };
}
test('moves whole event and metadata; preserves both days and rejects stale replay', async () => {
  const c = setup();
  try {
    const result = await move(c.input, c.deps);
    assert.equal(result.length, 2);
    assert.deepEqual(JSON.parse(c.read(c.input.sourceDate).tasks), { ...c.source, events: [{ id: 'other' }] });
    assert.deepEqual(JSON.parse(c.read(c.input.targetDate).tasks), { ...c.target, events: [...c.target.events, { ...c.event, date: c.input.targetDate }] });
    await assert.rejects(move(c.input, c.deps), { status: 409 });
  } finally { c.db.close(); }
});
test('destination conflicts and failed second writes leave both days unchanged', async () => {
  const c = setup();
  try {
    await assert.rejects(move({ ...c.input, targetRevision: 'stale' }, c.deps), { status: 409 });
    const original = c.deps.runSql;
    c.deps.runSql = async (sql, args, database) => { if (args[0] === c.input.targetDate) throw new Error('write failed'); return original(sql, args, database); };
    await assert.rejects(move(c.input, c.deps), /write failed/);
    assert.deepEqual(JSON.parse(c.read(c.input.sourceDate).tasks), c.source);
    assert.deepEqual(JSON.parse(c.read(c.input.targetDate).tasks), c.target);
  } finally { c.db.close(); }
});
test('new empty date, same owner day and invalid dates', async () => {
  const c = setup();
  try {
    await assert.rejects(move({ ...c.input, targetDate: '2026-02-30' }, c.deps), { status: 400 });
    await move({ ...c.input, targetDate: c.input.sourceDate, targetRevision: c.input.sourceRevision }, c.deps);
    const result = await move({ ...c.input, sourceRevision: revision(c.read(c.input.sourceDate)), targetDate: '2026-11-20', targetRevision: 'missing' }, c.deps);
    assert.equal(JSON.parse(result[1].tasks).events[0].date, '2026-11-20');
  } finally { c.db.close(); }
});
