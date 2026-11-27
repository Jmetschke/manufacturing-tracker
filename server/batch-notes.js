const { randomUUID } = require('node:crypto');
function updateBatchNotes(payload, { batchType, batchIndex, item, action, text, noteId }) {
  const fail = (message, status = 400) => Object.assign(new Error(message), { status });
  if (!['hijnx', 'sb'].includes(batchType) || !Number.isInteger(batchIndex) || batchIndex < 0) throw fail('Choose a valid batch.');
  const batch = (payload[batchType === 'hijnx' ? 'batchHijnx' : 'batchSb'] || [])[batchIndex];
  if (!batch || batch.item !== item) throw fail('This batch changed. Refresh the Daily Report before updating notes.', 409);
  const notes = Array.isArray(batch.notes) ? batch.notes : [];
  if (action === 'add') {
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000) throw fail('Enter a note of 1–2,000 characters.');
    batch.notes = [...notes, { id: randomUUID(), text: text.trim(), posted_at: new Date().toISOString() }];
  } else if (action === 'delete') {
    if (typeof noteId !== 'string' || !notes.some(note => note.id === noteId)) throw fail('This note is no longer available. Refresh the Daily Report.', 409);
    batch.notes = notes.filter(note => note.id !== noteId);
  } else throw fail('Choose add or delete for this note.');
  return payload;
}
module.exports = { updateBatchNotes };
