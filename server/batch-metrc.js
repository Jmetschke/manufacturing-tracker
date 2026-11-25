function updateBatchMetrc(payload, { batchType, batchIndex, item, metrc_number }) {
  if (!['hijnx', 'sb'].includes(batchType) || !Number.isInteger(batchIndex) || batchIndex < 0 ||
      typeof metrc_number !== 'string' || metrc_number.trim().length > 100) {
    throw Object.assign(new Error('Enter a Metrc # of 100 characters or fewer for a valid batch.'), { status: 400 });
  }
  const batch = (payload[batchType === 'hijnx' ? 'batchHijnx' : 'batchSb'] || [])[batchIndex];
  if (!batch || batch.item !== item) throw Object.assign(new Error('This batch changed. Refresh the Daily Report before saving.'), { status: 409 });
  batch.metrc_number = metrc_number.trim();
  return payload;
}
module.exports = { updateBatchMetrc };
