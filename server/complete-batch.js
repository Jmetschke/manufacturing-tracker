const CHECKLIST_KEYS = ['cooking', 'postCookingProcessing', 'packaging', 'sealed', 'counted', 'finalCountEnteredMetrc'];
function completeBatch(payload, { batchType, batchIndex, item, completedDate }) {
  const list = batchType === 'hijnx' ? payload.batchHijnx : payload.batchSb;
  const batch = list[batchIndex];
  if (!batch || typeof batch !== 'object' || batch.item !== item) {
    throw Object.assign(new Error('This batch changed. Refresh the Daily Report before completing it.'), { status: 409 });
  }
  batch.checklist = { ...batch.checklist, ...Object.fromEntries(CHECKLIST_KEYS.map(key => [key, true])) };
  const prefix = `${batchType}:${batchIndex}:`;
  for (const task of [...payload.tasks, ...payload.processingTasks]) {
    if (task && typeof task.sourceBatchKey === 'string' && task.sourceBatchKey.startsWith(prefix)) {
      task.completedDates = [...new Set([...(Array.isArray(task.completedDates) ? task.completedDates : []), completedDate])].sort();
    }
  }
  return payload;
}
module.exports = { completeBatch };
