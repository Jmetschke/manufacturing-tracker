const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updateBatchChecklist } = require('../server/batch-checklist');
const { completeBatch } = require('../server/complete-batch');
test('individual steps support completion and reopening without overwriting other batches or task history', () => {
  const payload = { batchHijnx: [{ item: 'A', checklist: { cooking: true, custom: true } }, { item: 'A', checklist: {} }], batchSb: [{ item: 'A', checklist: {} }], tasks: [], processingTasks: [{ sourceBatchKey: 'hijnx:0:A', completedDates: ['2026-11-01'] }], events: [{ id: 'keep' }] };
  const input = { batchType: 'hijnx', batchIndex: 0, item: 'A', key: 'packaging', completed: true };
  updateBatchChecklist(payload, input);
  assert.equal(payload.batchHijnx[0].checklist.packaging, true);
  assert.equal(payload.batchHijnx[0].checklist.cooking, true);
  assert.equal(payload.batchHijnx[0].checklist.custom, true);
  assert.deepEqual(payload.batchHijnx[1].checklist, {});
  assert.deepEqual(payload.batchSb[0].checklist, {});
  completeBatch(payload, { ...input, completedDate: '2026-11-09' });
  updateBatchChecklist(payload, { ...input, completed: false });
  assert.equal(payload.batchHijnx[0].checklist.packaging, false);
  assert.equal(payload.batchHijnx[0].checklist.finalCountEnteredMetrc, true);
  assert.deepEqual(payload.processingTasks[0].completedDates, ['2026-11-01', '2026-11-09']);
  assert.equal(payload.events[0].id, 'keep');
  assert.throws(() => updateBatchChecklist(payload, { ...input, item: 'Moved' }), { status: 409 });
  for (const bad of [{ key: 'bad' }, { completed: 'false' }, { batchType: 'bad' }, { batchIndex: -1 }]) {
    assert.throws(() => updateBatchChecklist(payload, { ...input, ...bad }), { status: 400 });
  }
});
