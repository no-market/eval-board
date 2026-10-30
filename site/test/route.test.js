import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../src/route.js';

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

test('a run address without a run, or with more after it, is not found', () => {
  for (const hash of ['#/receipt-lines/run', '#/receipt-lines/run/', '#/receipt-lines/run/a/b']) {
    assert.deepEqual(parseRoute(hash), { view: 'not-found' }, `hash ${hash}`);
  }
});

test('an address the site does not know is not found', () => {
  assert.deepEqual(parseRoute('#/promos'), { view: 'not-found' });
});
