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

test('an address the site does not know is not found', () => {
  assert.deepEqual(parseRoute('#/promos'), { view: 'not-found' });
});
