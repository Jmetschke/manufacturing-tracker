const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/admin.js', 'utf8');
const context = {
  itemTaskOptionsByItemId: { 1: [1, 2, 3], 2: [4] },
  allTasks: [
    { id: 1, name: 'Fill', average_seconds_per_unit: 12.5 },
    { id: 2, name: 'Pack', average_seconds_per_unit: null },
    { id: 3, name: 'Label', average_seconds_per_unit: 0 },
    { id: 4, name: 'Other item', average_seconds_per_unit: 100 }
  ],
  taskAverageReferencesByName: { fill: { average_seconds_per_unit: 99 }, pack: { average_seconds_per_unit: 5 } },
  normalizeTaskAverageReferenceName: name => name.toLowerCase()
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function calculateProductionEstimate('), source.indexOf('async function openProductionEstimate(')), context);
test('assigned tasks use recorded averages first and imported fallback; missing tasks stay explicit', () => {
  const result = context.calculateProductionEstimate('1', 100);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].seconds, 1250);
  assert.equal(result.rows[1].seconds, 500);
  assert.equal(result.rows[2].seconds, null);
  assert.equal(result.missing, 1);
  assert.equal(result.totalSeconds, 1750);
  assert.equal(context.calculateProductionEstimate('1', 200).totalSeconds, 3500);
});
test('invalid quantities and unassigned items cannot produce misleading estimates', () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 1e20]) {
    assert.equal(context.calculateProductionEstimate('1', quantity), null);
  }
  assert.equal(context.calculateProductionEstimate('missing', 10).rows.length, 0);
});
test('durations retain hours above a day and round only for display', () => {
  assert.equal(context.formatProductionEstimateTime(90061.1), '25h 1m 2s');
  assert.equal(context.formatProductionEstimateTime(1750), '0h 29m 10s');
});
