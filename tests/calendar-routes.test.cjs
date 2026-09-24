const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createCalendarStore, revision: calendarRevision } = require('../server/calendar-store');
const source = fs.readFileSync('server.js', 'utf8');
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE schedule_days(schedule_date TEXT PRIMARY KEY, tasks TEXT, updated_at TEXT)');
  const queries = [];
  const runSql = async (sql, args = []) => { queries.push(sql); return db.prepare(sql).run(...args); };
  const getSql = async (sql, args = []) => { queries.push(sql); return db.prepare(sql).get(...args); };
  const allSql = async (sql, args = []) => { queries.push(sql); return db.prepare(sql).all(...args); };
  const routes = {};
  const ctx = { crypto, console, db, calendarDb: db, hasSeparateCalendarDb: false,
    calendarRevision, calendarStore: createCalendarStore({ database: db, getSql, runSql }),
    runSql, getSql, allSql, MAX_SCHEDULE_TASKS_LENGTH: 100000,
    withTransaction: async fn => { db.exec('BEGIN'); try { const result = await fn(db); db.exec('COMMIT'); return result; } catch (err) { db.exec('ROLLBACK'); throw err; } },
    isIsoDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value), isWeekendIsoDate: date => [0,6].includes(new Date(date).getUTCDay()),
    app: { get: (path, fn) => routes['GET ' + path] = fn, put: (path, fn) => routes['PUT ' + path] = fn } };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('function parseSchedulePayloadForCleanup('), source.indexOf('function normalizeCompletionFallbackTask(')), ctx);
  vm.runInContext(source.slice(source.indexOf('app.get("/schedule"'), source.indexOf('app.put("/schedule/task-completion"')), ctx);
  async function call(key, body = {}) {
    let status = 200, data;
    await routes[key]({ query: { from: '2026-09-21', to: '2026-09-21' }, params: { date: '2026-09-21' }, body },
      { set() {}, status(value) { status = value; return this; }, json(value) { data = value; }, send(value) { data = value; } });
    return { status, data };
  }
  return { db, queries, call };
}
test('legacy IDs persist; normal reads and saves avoid all-day scans and preserve metadata', async () => {
  const { db, queries, call } = setup();
  db.prepare('INSERT INTO schedule_days VALUES (?, ?, ?)').run('2026-09-21', JSON.stringify({ customDayMetadata: 'keep', events: [{ title: 'Visit', date: '2026-09-22', days: 3, times: [{ start: '09:00', end: '10:00' }], location: 'Office', company: 'Hijnx', outlookEventId: 'external-id' }] }), 'old');
  let response = await call('GET /schedule');
  const first = response.data[0];
  const event = JSON.parse(first.tasks).events[0];
  assert.match(event.id, /^[a-f0-9-]{36}$/);
  queries.length = 0;
  response = await call('GET /schedule');
  assert.equal(response.data[0].revision, first.revision);
  assert.equal(queries.length, 1);
  queries.length = 0;
  const payload = JSON.parse(first.tasks);
  payload.events[0].title = 'Changed'; payload.events[0].outlookEventId = 'stale-client';
  response = await call('PUT /admin/schedule/:date', { tasks: JSON.stringify(payload), base_revision: first.revision });
  assert.equal(response.status, 200);
  const saved = JSON.parse(response.data.tasks);
  assert.equal(saved.events[0].id, event.id); assert.equal(saved.events[0].days, 3);
  assert.equal(saved.events[0].date, '2026-09-22'); assert.equal(saved.events[0].outlookEventId, 'external-id');
  assert.equal(saved.customDayMetadata, 'keep');
  assert.equal(queries.length, 2);
  response = await call('PUT /admin/schedule/:date', { tasks: first.tasks, base_revision: first.revision });
  assert.equal(response.status, 409);
  db.close();
});
