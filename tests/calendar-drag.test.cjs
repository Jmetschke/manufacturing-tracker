const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('public/admin-calendar-view.js', 'utf8').split('let calendarDraggedEvent = null;')[1];
function element() {
  const listeners = {}, classes = new Set();
  return { listeners, classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) }, addEventListener: (name, fn) => { listeners[name] = fn; }, contains: () => false };
}
test('drag targets submit the event identity and both revisions, then apply saved rows', async () => {
  const item = element(), cell = element(), editor = element();
  let request, message, renders = 0;
  const ctx = { document: { getElementById: () => editor, querySelectorAll: () => [] }, scheduleDaySavePending: false,
    adminCalendarLoadSequence: 0, adminScheduleRows: new Map(), adminScheduleRevisions: new Map([['2026-11-09', 'source'], ['2026-11-10', 'target']]),
    adminCalendarStartDate: '2026-11-09', showMessage: text => { message = text; }, dateOnly: value => value,
    addDays: value => value, buildAdminActiveScheduleByDate: rows => rows, closeAdminCalendarDayFocus() {},
    renderAdminCalendar: () => { renders++; }, formatDisplayDate: value => value,
    adminFetch: async (url, options) => { request = { url, body: JSON.parse(options.body) }; return { ok: true, json: async () => ({ rows: [{ schedule_date: '2026-11-10', tasks: '{}', revision: 'saved' }] }) }; }
  };
  vm.createContext(ctx); vm.runInContext('let calendarDraggedEvent = null;' + code, ctx);
  ctx.setupCalendarEventDrag(item, { id: 'id', sourceDate: '2026-11-09', date: '2026-11-09' });
  ctx.setupCalendarDropTarget(cell, '2026-11-10');
  const drag = { dataTransfer: { setData() {} }, preventDefault() {}, stopPropagation() {} };
  item.listeners.dragstart(drag);
  assert.equal(drag.dataTransfer.effectAllowed, 'move');
  cell.listeners.dragover(drag);
  assert.equal(cell.classList.contains('calendar-drop-target'), true);
  cell.listeners.drop(drag);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.body.eventId, 'id');
  assert.equal(request.body.sourceRevision, 'source');
  assert.equal(request.body.targetRevision, 'target');
  assert.equal(request.body.targetDate, '2026-11-10');
  assert.equal(ctx.adminScheduleRevisions.get('2026-11-10'), 'saved');
  assert.equal(renders, 1);
  assert.match(message, /Event moved/);
  editor.classList.add('active'); request = null;
  await ctx.moveAdminCalendarEvent({ id: 'id', date: '2026-11-09' }, '2026-11-11');
  assert.equal(request, null);
  assert.match(message, /Save or cancel/);
});
