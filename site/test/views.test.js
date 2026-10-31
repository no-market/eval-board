import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompare } from '../src/compare.js';
import { FLOWS } from '../src/flows.js';
import { renderPromoCompare } from '../src/promo-compare.js';
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

test('a promo run page, not built yet, says so and links the run file', () => {
  const html = viewsOf('promo-extraction').run({ flow: 'promo-extraction', id: 'r1', runFile: { flow: 'promo-extraction' } });
  assert.match(html, /not on the eval board yet/);
  assert.match(html, /href="https:\/\/github.com\/no-market\/eval-board\/blob\/main\/runs\/r1.json"/);
});

test('a promo run page of an unknown run says there is no such run', () => {
  const html = viewsOf('promo-extraction').run({ flow: 'promo-extraction', id: 'r1', runFile: undefined });
  assert.match(html, /There is no eval run r1/);
});

test('promo runs open the promo comparison', () => {
  assert.equal(viewsOf('promo-extraction').compare, renderPromoCompare);
});
