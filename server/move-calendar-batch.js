// Move a batch and its linked tasks, keeping positional batch keys consistent.
module.exports = function moveBatch(source, target, input) {
  const { sourceDate, targetDate, batchType, batchIndex, item } = input;
  const fail = message => Object.assign(new Error(message), { status: 409 });
  if (!['hijnx', 'sb'].includes(batchType) || !Number.isInteger(batchIndex) || batchIndex < 0) throw fail('Invalid production batch. Refresh the calendar.');
  const field = batchType === 'hijnx' ? 'batchHijnx' : 'batchSb';
  const batch = (source[field] || [])[batchIndex];
  if (!batch || batch.item !== item) throw fail('This batch changed. Refresh the calendar before moving it.');
  if (sourceDate === targetDate) return;
  const day = new Date(targetDate + 'T00:00:00Z').getUTCDay();
  if (day === 0 || day === 6) throw Object.assign(new Error('Production tasks are scheduled on weekdays. Drop this batch on Monday through Friday.'), { status: 400 });
  const destination = target[field] || [];
  const newIndex = destination.length;
  const offset = Date.parse(targetDate) - Date.parse(sourceDate);
  const rekey = (task, index) => ({ ...task,
    sourceBatchKey: task.sourceBatchKey.replace(/^(hijnx|sb):\d+:/, `${batchType}:${index}:`)
  });
  for (const key of ['tasks', 'processingTasks']) {
    const kept = [], moved = [];
    for (const task of source[key] || []) {
      const match = typeof task.sourceBatchKey === 'string' && task.sourceBatchKey.match(/^(hijnx|sb):(\d+):/);
      if (!match || match[1] !== batchType) { kept.push(task); continue; }
      const index = Number(match[2]);
      if (index === batchIndex) {
        const updated = rekey(task, newIndex);
        updated.sourceBatchLabel = `${batchType === 'hijnx' ? 'Hijnx' : 'SB'} batch ${newIndex + 1}: ${batch.item}`;
        const planned = /^\d{4}-\d{2}-\d{2}$/.test(task.scheduleDate || '') ? task.scheduleDate : sourceDate;
        updated.scheduleDate = new Date(Date.parse(planned) + offset).toISOString().slice(0, 10);
        moved.push(updated);
      } else if (index > batchIndex) {
        const updated = rekey(task, index - 1);
        updated.sourceBatchLabel = `${batchType === 'hijnx' ? 'Hijnx' : 'SB'} batch ${index}: ${source[field][index]?.item || ''}`;
        kept.push(updated);
      } else kept.push(task);
    }
    if (Array.isArray(source[key])) source[key] = kept;
    if (moved.length) target[key] = [...(target[key] || []), ...moved];
  }
  source[field].splice(batchIndex, 1);
  target[field] = [...destination, batch];
};
