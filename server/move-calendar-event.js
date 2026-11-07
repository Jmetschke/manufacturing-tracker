const { revision } = require('./calendar-store');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
module.exports = async function moveCalendarEvent(input, { database, mirrorDatabase, withTransaction, getSql, runSql }) {
  const { sourceDate, targetDate, eventId, sourceRevision, targetRevision } = input;
  if (!validDate(sourceDate) || !validDate(targetDate) || typeof eventId !== 'string') throw fail('Choose a valid event and destination date.');
  if (!sourceRevision || !targetRevision) throw fail('Refresh the calendar before moving an event.', 428);
  const saved = await withTransaction(async transaction => {
    const read = date => getSql('SELECT schedule_date, tasks FROM schedule_days WHERE schedule_date = ?', [date], transaction);
    const source = await read(sourceDate);
    const target = sourceDate === targetDate ? source : await read(targetDate);
    if (revision(source) !== sourceRevision || revision(target) !== targetRevision) throw fail('The calendar changed. Refresh it before moving this event again.', 409);
    const parse = row => row ? JSON.parse(row.tasks) : { events: [] };
    const sourcePayload = parse(source);
    const event = (sourcePayload.events || []).find(event => event.id === eventId);
    if (!event) throw fail('This event no longer exists. Refresh the calendar.', 409);
    const targetPayload = sourceDate === targetDate ? sourcePayload : parse(target);
    const moved = { ...event, date: targetDate };
    if (sourceDate === targetDate) {
      sourcePayload.events = sourcePayload.events.map(value => value.id === eventId ? moved : value);
    } else {
      if ((targetPayload.events || []).some(value => value.id === eventId)) throw fail('This event already exists on the destination day.', 409);
      sourcePayload.events = sourcePayload.events.filter(value => value.id !== eventId);
      targetPayload.events = [...(targetPayload.events || []), moved];
    }
    const rows = sourceDate === targetDate ? [[sourceDate, sourcePayload]] : [[sourceDate, sourcePayload], [targetDate, targetPayload]];
    const result = [];
    for (const [date, payload] of rows) {
      const tasks = JSON.stringify(payload);
      if (tasks.length > 100000) throw fail('The destination calendar day is too large.');
      await runSql(`INSERT INTO schedule_days (schedule_date, tasks, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(schedule_date) DO UPDATE SET tasks = excluded.tasks, updated_at = excluded.updated_at`, [date, tasks], transaction);
      result.push({ schedule_date: date, tasks, revision: revision({ tasks }) });
    }
    return result;
  }, database);
  if (mirrorDatabase) {
    try {
      await withTransaction(async transaction => {
        for (const row of saved) await runSql(`INSERT INTO schedule_days (schedule_date, tasks, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(schedule_date) DO UPDATE SET tasks = excluded.tasks, updated_at = excluded.updated_at`, [row.schedule_date, row.tasks], transaction);
      }, mirrorDatabase);
    } catch (err) { console.error('Could not mirror moved calendar event:', err.message); }
  }
  return saved;
};
