import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompare } from '../src/compare.js';
import { FLOWS } from '../src/flows.js';
import { renderPromoRun } from '../src/promo-run.js';
import { renderPromoTab } from '../src/promo-tab.js';
import { renderRun } from '../src/run.js';
import { renderTab } from '../src/tab.js';
import { viewsOf } from '../src/views.js';

test('every flow has a tab, a run page and a comparison', () => {
  for (const flow of FLOWS) {
    const views = viewsOf(flow.id);
    for (const view of ['tab', 'run', 'compare']) {
      assert.equal(typeof views[view], 'function', `${flow.id} has a ${view} view`);
    }
  }
});

test('receipt lines runs open the receipt lines views', () => {
  assert.deepEqual(viewsOf('receipt-lines'), { tab: renderTab, run: renderRun, compare: renderCompare });
});

test('promo runs open the promos tab', () => {
  assert.equal(viewsOf('promo-extraction').tab, renderPromoTab);
});

test('promo runs open the promo run page', () => {
  assert.equal(viewsOf('promo-extraction').run, renderPromoRun);
});

test('a comparison of promo runs, not built yet, says so', () => {
  const html = viewsOf('promo-extraction').compare({ flow: 'promo-extraction', a: { id: 'a' }, b: { id: 'b' } });
  assert.match(html, /not on the eval board yet/);
});
