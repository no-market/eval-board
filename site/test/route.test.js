import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareAddress, parseRoute, runAddress, tabAddress } from '../src/route.js';

test('the bare site opens the receipt lines tab', () => {
  for (const hash of ['', '#', '#/']) {
    assert.deepEqual(parseRoute(hash), { view: 'tab', flow: 'receipt-lines' }, `hash ${JSON.stringify(hash)}`);
  }
});

test('#/receipt-lines opens the receipt lines tab', () => {
  assert.deepEqual(parseRoute('#/receipt-lines'), { view: 'tab', flow: 'receipt-lines' });
});

test('#/receipt-lines/run/<run> opens that run page', () => {
  assert.deepEqual(parseRoute('#/receipt-lines/run/2026-10-30T165731-google-gemini-2.5-flash'), {
    view: 'run',
    flow: 'receipt-lines',
    run: '2026-10-30T165731-google-gemini-2.5-flash',
  });
});

test('the run address encodes the run, as the compare address does, and opens it again', () => {
  const run = '2026-10-30T165731-a b#c?d/e%f';
  const address = runAddress('receipt-lines', run);
  assert.equal(address, '#/receipt-lines/run/2026-10-30T165731-a%20b%23c%3Fd%2Fe%25f');
  assert.deepEqual(parseRoute(address), { view: 'run', flow: 'receipt-lines', run });
});

test('a run address without a run, or with more after it, is not found', () => {
  for (const hash of ['#/receipt-lines/run', '#/receipt-lines/run/', '#/receipt-lines/run/a/b']) {
    assert.deepEqual(parseRoute(hash), { view: 'not-found' }, `hash ${hash}`);
  }
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

test('#/<flow>/compare/<run A>/<run B> opens the comparison of the two runs', () => {
  assert.deepEqual(parseRoute('#/receipt-lines/compare/2026-10-29T194800-a/2026-10-30T165731-b'), {
    view: 'compare',
    flow: 'receipt-lines',
    a: '2026-10-29T194800-a',
    b: '2026-10-30T165731-b',
  });
});

test('the compare address names A then B', () => {
  const address = compareAddress('receipt-lines', 'older', 'newer');
  assert.equal(address, '#/receipt-lines/compare/older/newer');
  assert.deepEqual(parseRoute(address), { view: 'compare', flow: 'receipt-lines', a: 'older', b: 'newer' });
});

test('a compare address without two runs is not found', () => {
  assert.deepEqual(parseRoute('#/receipt-lines/compare/one'), { view: 'not-found' });
  assert.deepEqual(parseRoute('#/receipt-lines/compare/one/two/three'), { view: 'not-found' });
});

test('a run or compare address with a broken escape is not found', () => {
  for (const hash of ['#/receipt-lines/run/%E0', '#/receipt-lines/compare/%E0/b']) {
    assert.deepEqual(parseRoute(hash), { view: 'not-found' }, `hash ${hash}`);
  }
});

test('an address the site does not know is not found', () => {
  assert.deepEqual(parseRoute('#/promos'), { view: 'not-found' });
});
