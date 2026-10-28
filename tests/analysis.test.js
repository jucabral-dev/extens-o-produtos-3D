import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, analyzeExtras, estimateDemand, calculateProfit } from '../extension/analysis.js';
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
test('demand compares historical pace to a configurable target', () => {
  assert.equal(estimateDemand(10, '1').label, 'Meta atingida');
  assert.equal(estimateDemand(10, '11').label, 'Abaixo da meta');
  assert.equal(estimateDemand(0, '1').label, 'Sem vendas registradas');
  assert.equal(estimateDemand(0.5, '0,50').label, 'Meta atingida');
});
test('missing demand is not represented as no sales', () => {
  assert.equal(estimateDemand(null).label, 'Dados insuficientes');
  for (const target of ['0','-1','','1mil']) assert.throws(() => estimateDemand(10, target));
});
test('profit includes percentage fee, fixed fee, product and other unit costs', () => {
  const result = calculateProfit({ price:'50,00', cost:'15', percentFee:'20', fixedFee:'4', otherCosts:'3' });
  assert.equal(result.profitCents, 1800);
  assert.equal(result.margin, 0.36);
  assert.equal(result.totalCostCents, 3200);
});
test('profit preserves losses and handles zero margin', () => {
  assert.equal(calculateProfit({ price:'10', cost:'10', percentFee:'20', fixedFee:'4' }).profitCents, -600);
  assert.equal(calculateProfit({ price:'10', cost:'0', percentFee:'100', fixedFee:'0' }).profitCents, 0);
});
test('percentage fees are rounded to cents, not rounded to whole reais', () => {
  const result = calculateProfit({ price:'20.50', cost:'0', percentFee:'12,5', fixedFee:'0' });
  assert.equal(result.percentageFeeCents, 256);
  assert.equal(result.profitCents, 1794);
});
test('profit requires applicable fees explicitly, without presuming Shopee rates', () => {
  const fields = { price:'50', cost:'15', percentFee:'20', fixedFee:'4' };
  for (const update of [{price:'0'}, {cost:'-1'}, {percentFee:''}, {fixedFee:''}, {percentFee:'100.01'}, {price:'1.000'}, {otherCosts:'NaN'}]) assert.throws(() => calculateProfit({...fields,...update}));
});
