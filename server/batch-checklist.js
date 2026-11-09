const KEYS = ['cooking', 'postCookingProcessing', 'packaging', 'sealed', 'counted', 'finalCountEnteredMetrc'];
function updateBatchChecklist(payload, { batchType, batchIndex, item, key, completed }) {
  if (!['hijnx', 'sb'].includes(batchType) || !Number.isInteger(batchIndex) || batchIndex < 0 ||
      !KEYS.includes(key) || typeof completed !== 'boolean') {
    throw Object.assign(new Error('Choose a valid batch step and completion status.'), { status: 400 });
  }
  const batch = (payload[batchType === 'hijnx' ? 'batchHijnx' : 'batchSb'] || [])[batchIndex];
  if (!batch || batch.item !== item) throw Object.assign(new Error('This batch changed. Refresh the Daily Report before updating it.'), { status: 409 });
  batch.checklist = { ...batch.checklist, [key]: completed };
  return payload;
}
module.exports = { updateBatchChecklist };
