function updateBatchPriority(payload, { batchType, batchIndex, item, priority }) {
  if (!['hijnx', 'sb'].includes(batchType) || !Number.isInteger(batchIndex) || batchIndex < 0 || ![1, 2, 3].includes(priority)) {
    throw Object.assign(new Error('Choose priority 1, 2, or 3 for a valid batch.'), { status: 400 });
  }
  const batch = (payload[batchType === 'hijnx' ? 'batchHijnx' : 'batchSb'] || [])[batchIndex];
  if (!batch || batch.item !== item) throw Object.assign(new Error('This batch changed. Refresh the Daily Report before saving.'), { status: 409 });
  batch.priority = priority;
  return payload;
}
module.exports = { updateBatchPriority };
