import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, analyzeExtras } from '../extension/analysis.js';
const now = new Date(2026, 9, 28, 12);
test('compares sales over the actual lifetime rather than totals alone', () => {
  const recent = analyze('300', '2026-09-28', now);
  const older = analyze('1000', '2023-10-28', now);
  assert.equal(recent.ageDays, 30);
  assert.equal(recent.daily, 10);
  assert.ok(recent.daily > older.daily);
});
test('same-day listing does not invent a daily rate', () => {
  assert.equal(analyze('3', '2026-10-28', now).daily, null);
});
test('zero sales is valid', () => {
  assert.equal(analyze('0', '2026-10-27', now).daily, 0);
});
test('rejects future dates and invalid calendar dates', () => {
  for (const date of ['2026-10-29', '2026-02-30', '', '2026-13-01']) assert.throws(() => analyze('10', date, now));
});
test('rejects rounded or ambiguous sale counts instead of inventing precision', () => {
  for (const sales of ['1mil', '1,2', '-1', '2.5', '', '9007199254740992']) assert.throws(() => analyze(sales, '2026-10-01', now));
});
test('optional fields remain unknown instead of becoming zero', () => {
  const extra = analyzeExtras({}, analyze('300', '2026-09-28', now), now);
  assert.equal(extra.stock, null);
  assert.equal(extra.visitsPerSale, null);
  assert.equal(extra.itemsPerVisit, null);
});
test('calculates ratios without division by zero and preserves zero stock', () => {
  const result = analyze('500', '2026-09-28', now);
  const extra = analyzeExtras({ stock: '0', visits: '2969' }, result, now);
  assert.equal(extra.stock, 0);
  assert.equal(extra.visitsPerSale, 2969 / 500);
  assert.equal(extra.itemsPerVisit, 500 / 2969);
  assert.equal(analyzeExtras({ visits: '0' }, result, now).itemsPerVisit, null);
  assert.equal(analyzeExtras({ visits: '10' }, analyze('0', '2026-09-28', now), now).visitsPerSale, null);
});
test('validates optional counts and update dates', () => {
  const result = analyze('500', '2026-09-28', now);
  for (const fields of [{stock:'-1'}, {visits:'1mil'}, {updated:'2026-09-27'}, {updated:'2026-10-29'}]) assert.throws(() => analyzeExtras(fields, result, now));
  assert.equal(analyzeExtras({updated:'2026-10-10'}, result, now).updated, '2026-10-10');
});
