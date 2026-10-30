import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, tabAddress } from '../src/route.js';

test('the bare site opens the receipt lines tab', () => {
  for (const hash of ['', '#', '#/']) {
    assert.deepEqual(parseRoute(hash), { view: 'tab', flow: 'receipt-lines' }, `hash ${JSON.stringify(hash)}`);
  }
});

test('#/receipt-lines opens the receipt lines tab', () => {
  assert.deepEqual(parseRoute('#/receipt-lines'), { view: 'tab', flow: 'receipt-lines' });
});

test('?base=<run> sets the baseline of the tab', () => {
  assert.deepEqual(parseRoute('#/receipt-lines?base=2026-10-30T165731-a'), {
    view: 'tab',
    flow: 'receipt-lines',
    base: '2026-10-30T165731-a',
  });
});

test('the tab address carries the baseline, and drops it when cleared', () => {
  assert.equal(tabAddress('receipt-lines', '2026-10-30T165731-a'), '#/receipt-lines?base=2026-10-30T165731-a');
  assert.equal(tabAddress('receipt-lines', null), '#/receipt-lines');
  assert.deepEqual(parseRoute(tabAddress('receipt-lines', null)), { view: 'tab', flow: 'receipt-lines' });
});

test('an address the site does not know is not found', () => {
  assert.deepEqual(parseRoute('#/promos'), { view: 'not-found' });
});
