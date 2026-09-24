const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { completeBatch } = require('../server/complete-batch');

test('completes only the selected batch and its tasks, preserving history and event metadata', () => {
  const payload = { batchHijnx: [{ item: 'A', checklist: { custom: true } }, { item: 'A', checklist: {} }],
    batchSb: [{ item: 'A', checklist: {} }], events: [{ id: 'stable', outlookEventId: 'external' }],
    tasks: [{ text: 'Cooking', sourceBatchKey: 'hijnx:0:A', completedDates: ['2026-09-20'] }],
    processingTasks: [{ text: 'Pack', sourceBatchKey: 'hijnx:0:A:2:Pack' },
      { text: 'Pack', sourceBatchKey: 'hijnx:1:A' }, { text: 'Pack', sourceBatchKey: 'sb:0:A' },
      { text: 'Unrelated', item: 'A' }] };
  const options = { batchType: 'hijnx', batchIndex: 0, item: 'A', completedDate: '2026-09-24' };
  completeBatch(payload, options);
  assert.equal(Object.values(payload.batchHijnx[0].checklist).every(Boolean), true);
  assert.equal(payload.batchHijnx[0].checklist.finalCountEnteredMetrc, true);
  assert.deepEqual(payload.tasks[0].completedDates, ['2026-09-20','2026-09-24']);
  assert.deepEqual(payload.processingTasks[0].completedDates, ['2026-09-24']);
  assert.equal(payload.processingTasks[1].completedDates, undefined);
  assert.equal(payload.processingTasks[2].completedDates, undefined);
  assert.equal(payload.processingTasks[3].completedDates, undefined);
  assert.deepEqual(payload.batchHijnx[1].checklist, {});
  assert.equal(payload.events[0].outlookEventId, 'external');
  completeBatch(payload, options);
  assert.equal(payload.processingTasks[0].completedDates.length, 1);
  assert.throws(() => completeBatch(payload, { ...options, item: 'Changed' }), { status: 409 });
});

test('Daily Report excludes completed tasks and generated fallback tasks for completed batches', () => {
  const context = { isBatchInProgress: batch => !batch.done };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/daily-batch-completion.js','utf8'), context);
  const tasks = [
    { sourceScheduleDate:'2026-09-24',sourceBatchKey:'hijnx:0:A:1:Pack' },
    { sourceScheduleDate:'2026-09-23',sourceBatchKey:'hijnx:0:A' },
    { completedAny:true }, { text:'Unrelated' }
  ];
  const remaining = context.filterDailyIncompleteTasks(tasks, [{ scheduleDate:'2026-09-24',batchType:'hijnx',batchIndex:0,done:true }]);
  assert.equal(remaining.length,2);
  assert.equal(remaining[0],tasks[1]); assert.equal(remaining[1],tasks[3]);
});

test('card action sends its original revision, blocks repeats, and removes only after success', async () => {
  let request, release, reloads = 0;
  const response = new Promise(resolve => { release = resolve; });
  const card = { children: [], append(...nodes) { this.children.push(...nodes); }, remove() { this.removed = true; } };
  const context = { document: { createElement() { return { style: {}, setAttribute() {}, addEventListener(type, fn) { this.click = fn; } }; } },
    confirm: () => true, toIsoDate: () => '2026-09-24', loadDailyReport: async () => { reloads++; },
    fetch: async (url, options) => { request = { url, body: JSON.parse(options.body) }; return response; } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/daily-batch-completion.js','utf8'), context);
  context.appendDailyBatchCompletion(card, { scheduleDate:'2026-09-21',batchType:'hijnx',batchIndex:2,item:'A',label:'Hijnx',revision:'original' });
  const button = card.children[0];
  const pending = button.click({ stopPropagation() {} });
  assert.equal(button.disabled, true); assert.equal(card.removed, undefined);
  assert.equal(request.body.base_revision, 'original'); assert.equal(request.body.batchIndex, 2);
  release({ ok:true }); await pending;
  assert.equal(card.removed,true); assert.equal(reloads,1);
});
