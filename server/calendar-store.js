const crypto = require('crypto');

// Revisions describe exact stored content, including changes from other applications.
function revision(row) {
  return row ? crypto.createHash('sha256').update(JSON.stringify(row.tasks)).digest('hex') : 'missing';
}
function conflict() {
  return Object.assign(new Error('This calendar day changed after you opened it. Reload the saved day before editing again.'), { status: 409 });
}
function createCalendarStore({ database, mirrorDatabase, getSql, runSql }) {
  const read = date => getSql('SELECT schedule_date, tasks, updated_at FROM schedule_days WHERE schedule_date = ?', [date], database);
  async function commit(date, tasks, previous) {
    const result = previous
      ? await runSql(`UPDATE schedule_days SET tasks = ?, updated_at = datetime('now')
          WHERE schedule_date = ? AND tasks IS ?`, [tasks, date, previous.tasks], database)
      : await runSql(`INSERT INTO schedule_days (schedule_date, tasks, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(schedule_date) DO NOTHING`, [date, tasks], database);
    if (!result.changes) throw conflict();
    if (mirrorDatabase) {
      try {
        await runSql(`INSERT INTO schedule_days (schedule_date, tasks, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(schedule_date) DO UPDATE SET tasks = excluded.tasks, updated_at = excluded.updated_at`,
        [date, tasks], mirrorDatabase);
      } catch (err) { console.error(`Could not mirror calendar day ${date}:`, err.message); }
    }
    return { schedule_date: date, tasks, revision: revision({ tasks }) };
  }
  async function save(date, expectedRevision, transform) {
    if (typeof expectedRevision !== 'string' || !expectedRevision) {
      throw Object.assign(new Error('Refresh the app before saving this calendar day.'), { status: 428 });
    }
    const previous = await read(date);
    if (revision(previous) !== expectedRevision) throw conflict();
    return commit(date, await transform(previous), previous);
  }
  async function update(date, transform) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await read(date);
      const tasks = await transform(previous);
      try { return await commit(date, tasks, previous); }
      catch (err) { if (err.status !== 409 || attempt === 2) throw err; }
    }
  }
  return { read, save, update };
}
module.exports = { createCalendarStore, revision };
