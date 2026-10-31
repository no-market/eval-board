import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise } from '../build/summarise.js';
import { renderPromoTab } from '../src/promo-tab.js';

const fixture = async (id) => summarise(`${id}.json`, JSON.parse(await readFile(new URL(`./fixtures/${id}.json`, import.meta.url), 'utf8')));
// The real run with verdicts: 9 of 22 promos in error, $0.0119463 over 8 pages.
const REAL = '20261031T132616405937-promo';
const entry = await fixture(REAL);
const FLOW = 'promo-extraction';
// An older run of the same eval set: 10 of 22 in error, $0.01819464 over 8 pages.
const older = {
  ...entry,
  run: 'older',
  date: '2026-10-31T12:38:02Z',
  totals: { ...entry.totals, errors: { count: 10, share: 10 / 22 }, costUsd: 0.01819464, knownCostUsd: 0.01819464 },
};

// The chart's section of the tab.
function chart(html) {
  return html.match(/<section aria-labelledby="chart-h"[\s\S]*?<\/section>/)?.[0] ?? '';
}

// Each point on the chart, as { run, x, y }: x the share of the plot's width,
// y the pixels from the plot's top (320 high).
function points(html) {
  return [...chart(html).matchAll(/<g class="point" data-point="([^"]+)"[^>]*>\s*<svg x="([\d.]+)%" y="([\d.]+)"/g)].map(
    ([, run, x, y]) => ({ run, x: Number(x), y: Number(y) }),
  );
}

test('a point per run, placed by cost per page across and error rate up', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older] });
  // Axes of 0 to 0.25¢ and 0 to 50%: the real run at 0.1493¢ / 0.25¢ across and
  // 40.9% / 50% up a plot 320 high; the older at 0.2274¢ / 0.25¢ and 45.5% / 50%.
  assert.deepEqual(points(html), [
    { run: REAL, x: 59.73, y: 58.18 },
    { run: 'older', x: 90.97, y: 29.09 },
  ]);
});

test('runs of other eval sets, and runs without verdicts, have no point', async () => {
  const otherScorer = { ...older, run: 'other-scorer', evalSet: { ...entry.evalSet, scorer: 'promo-core-text-v5' } };
  const unscored = await fixture('20261030T183542318891-promo');
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older, otherScorer, unscored] });
  assert.deepEqual(points(html).map(({ run }) => run), [REAL, 'older']);
});

test('both axes start at 0', () => {
  const svg = chart(renderPromoTab({ flow: FLOW, runs: [entry, older] }));
  const yLabels = [...svg.matchAll(/<text class="y-tick"[^>]*>([^<]*)<\/text>/g)].map(([, t]) => t);
  const xLabels = [...svg.matchAll(/<text class="x-tick"[^>]*>([^<]*)<\/text>/g)].map(([, t]) => t);
  assert.deepEqual(yLabels, ['0%', '10%', '20%', '30%', '40%', '50%']);
  assert.deepEqual(xLabels, ['0¢', '0.05¢', '0.1¢', '0.15¢', '0.2¢', '0.25¢']);
  assert.match(svg, /<h2 id="chart-h">Error rate against cost per page<\/h2>/);
});

test('a run whose cost is not known in full is placed at the priced part', () => {
  // $0.008 priced over 8 pages: 0.1¢ of the axis's 0.25¢.
  const partial = { ...entry, totals: { ...entry.totals, costUsd: null, knownCostUsd: 0.008 } };
  const html = renderPromoTab({ flow: FLOW, runs: [partial, older] });
  assert.deepEqual(points(html)[0], { run: REAL, x: 40, y: 58.18 });
  assert.match(chart(html), /aria-label="Tick the run of 31 Oct 2026, 13:26: promo-v4 · gemini-2.5-flash, error rate 40.9%, at least 0.10¢ per page"/);
});

test('the chart is above the table, and a ticked run’s point is marked', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older], ticked: ['older'] });
  assert.ok(html.indexOf('aria-labelledby="chart-h"') < html.indexOf('<table'));
  const pressed = [...chart(html).matchAll(/data-point="([^"]+)"[^>]*aria-pressed="(\w+)"/g)].map(([, run, p]) => [run, p]);
  assert.deepEqual(pressed, [[REAL, 'false'], ['older', 'true']]);
});
