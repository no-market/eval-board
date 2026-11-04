import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise } from '../build/summarise.js';
import { viewsOf } from '../src/views.js';

const FLOW = 'promo-kinds';
const ID = '20261104T160000000000-promo-kinds';
const runFile = JSON.parse(await readFile(new URL(`./fixtures/${ID}.json`, import.meta.url), 'utf8'));
// The fixture run: 6 of 9 promos in error, $0.0072 over 9 promos.
const entry = summarise(`${ID}.json`, runFile);
// An older run of the same eval set: 7 of 9 in error, $0.0090 over 9 promos,
// 3 seconds a promo.
const older = {
  ...entry,
  run: 'older',
  date: '2026-11-04T10:00:00Z',
  totals: {
    ...entry.totals,
    errors: { count: 7, share: 7 / 9 },
    seconds: { median: 3, p95: 4 },
    costUsd: 0.009,
    knownCostUsd: 0.009,
  },
};
const otherSet = {
  ...entry,
  run: 'other-set',
  date: '2026-11-03T10:00:00Z',
  evalSet: { ...entry.evalSet, scorer: 'promo-kinds-v0' },
};

const tab = (options) => viewsOf(FLOW).tab({ flow: FLOW, runs: [entry], ...options });

const text = (cell) => cell.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function headers(html) {
  const thead = html.match(/<section aria-labelledby="runs-h"[\s\S]*?<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
  return [...thead.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) => text(cell));
}
function bodyRows(html) {
  const tbody = html.match(/<section aria-labelledby="runs-h"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => text(cell)),
  );
}

test('the heading names the current eval set, counted in promos', () => {
  assert.match(text(tab()), /1 eval run on the eval set promo-kinds-reviewed-v1 · promo-kinds-v1 · 9 promos/);
});

test('the columns, in order', () => {
  assert.deepEqual(headers(tab()), [
    'Compare',
    'Date',
    'Prompt',
    'Model',
    'Promos',
    'Error rate',
    'Warning rate',
    's / promo',
    'Cost / promo',
    'Baseline',
  ]);
});

test('the table shows the cells of the fixture run', () => {
  assert.deepEqual(bodyRows(tab()), [
    [
      '',
      '4 Nov 2026, 16:00',
      'promo-kinds-v1',
      'claude-haiku-5.5',
      '9',
      '66.7% (6 of 9)',
      '11.1% (1 of 9)',
      '2.0 s',
      '0.08¢',
      'Set as baseline',
    ],
  ]);
});

test('the date links to the run page', () => {
  assert.ok(tab().includes(`href="#/promo-kinds/run/${ID}"`));
});

test('the table holds only the runs of the current eval set', () => {
  const rows = bodyRows(tab({ runs: [entry, older, otherSet] }));
  assert.deepEqual(rows.map((row) => row[1]), ['4 Nov 2026, 16:00', '4 Nov 2026, 10:00']);
});

test('the current eval set is that of the newest run, though its schema_version is 1', () => {
  const rows = bodyRows(tab({ runs: [otherSet, entry] }));
  assert.deepEqual(rows.map((row) => row[1]), ['4 Nov 2026, 16:00']);
});

test('a baseline shows differences in promos and points, seconds and cents', () => {
  const [row] = bodyRows(tab({ runs: [older, entry], base: entry.run }));
  assert.equal(row[5], '77.8% (7 of 9)▲ +1 promo · +11.1 pts');
  assert.equal(row[7], '3.0 s▲ +1.0 s · +50%');
  assert.equal(row[8], '0.10¢▲ +0.02¢ · +25%');
});

test('ticking two runs opens their comparison, A the older', () => {
  const html = tab({ runs: [entry, older], ticked: [entry.run, 'older'] });
  assert.ok(html.includes(`href="#/promo-kinds/compare/older/${ID}"`));
});

test('cost per promo is the priced part, marked ≥, when some calls were not priced', () => {
  const unpriced = { ...entry, totals: { ...entry.totals, costUsd: null } };
  assert.equal(bodyRows(tab({ runs: [unpriced] }))[0][8], '≥ 0.08¢');
});

test('the tab says the eval set is made of hard cases, for comparing configurations only', () => {
  assert.match(text(tab()), /made of hard cases/);
  assert.match(text(tab()), /compares configurations only/);
});

test('with no runs the tab says so', () => {
  const html = tab({ runs: [] });
  assert.match(text(html), /No promo kinds eval runs yet/);
  assert.doesNotMatch(html, /<table/);
  assert.doesNotMatch(html, /hard cases/);
});

// The chart's section of the tab, and each point on it as { run, x, y }: x the
// share of the plot's width, y the pixels from the plot's top (320 high).
const chart = (html) => html.match(/<section aria-labelledby="chart-h"[\s\S]*?<\/section>/)?.[0] ?? '';
const points = (html) =>
  [...chart(html).matchAll(/<g class="point" data-point="([^"]+)"[^>]*>\s*<svg x="([\d.]+)%" y="([\d.]+)"/g)].map(
    ([, run, x, y]) => ({ run, x: Number(x), y: Number(y) }),
  );

test('the chart has a point per run of the current eval set, by error rate against cost per promo', () => {
  const html = tab({ runs: [entry, older, otherSet] });
  assert.match(chart(html), /Error rate against cost per promo/);
  // y: error rate on an axis to 80%, 320 pixels high. The cheaper run stands left.
  const [fixture, costlier] = points(html);
  assert.equal(fixture.run, entry.run);
  assert.equal(fixture.y, 53.33);
  assert.equal(costlier.run, 'older');
  assert.equal(costlier.y, 8.89);
  assert.ok(fixture.x < costlier.x);
  assert.equal(points(html).length, 2);
});

test('a point is labelled with its prompt and model, and ticks its run', () => {
  const html = tab({ ticked: [entry.run] });
  assert.match(chart(html), /promo-kinds-v1 · claude-haiku-5\.5/);
  assert.match(chart(html), /aria-pressed="true"/);
  assert.match(chart(html), /per promo/);
});

test('a run with unpriced calls stands at its priced part, as the chart says below it', () => {
  const unpriced = { ...entry, totals: { ...entry.totals, costUsd: null } };
  const html = tab({ runs: [unpriced] });
  assert.equal(points(html).length, 1);
  assert.match(chart(html), /Cost per promo, the run’s cost over its promos; the priced part when some calls weren’t priced/);
});

// The section of errors by group: its headers and rows, a row's first cell
// being its group.
const groups = (html) => html.match(/<section aria-labelledby="groups-h"[\s\S]*?<\/section>/)?.[0] ?? '';
const groupHeaders = (html) => [...groups(html).matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) => text(cell));
const groupRows = (html) =>
  [...groups(html).matchAll(/<tr>\s*<th scope="row">([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/g)].map(([, group, cells]) => [
    text(group),
    ...[...cells.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => text(cell)),
  ]);

test('errors by group: a row per group and a column per run, counted in promos', () => {
  const html = tab({ runs: [entry] });
  assert.deepEqual(groupHeaders(html), ['Group', 'claude-haiku-5.5 4 Nov 2026, 16:00']);
  assert.deepEqual(groupRows(html), [
    ['kind-boundaries', '1 of 1'],
    ['new-kind', '1 of 2'],
    ['one-kind', '1 of 2'],
    ['out-of-scope', '1 of 1'],
    ['pet-household', '1 of 1'],
    ['range-many-kinds', '1 of 1'],
    ['unclear', '0 of 1'],
  ]);
});

test('errors by group: a group one run lacks is a dash, and runs of other eval sets have no column', () => {
  const { unclear, ...others } = entry.byGroup;
  const lacking = { ...older, byGroup: others };
  const html = tab({ runs: [entry, lacking, otherSet] });
  assert.equal(groupHeaders(html).length, 3);
  assert.deepEqual(groupRows(html).at(-1), ['unclear', '0 of 1', '—']);
});

test('errors by group: a column names its run’s prompt on hover', () => {
  assert.match(groups(tab()), /<th scope="col" class="num" title="promo-kinds-v1">/);
});

test('the chart and errors by group sit side by side, and the groups scroll inside their table', () => {
  const html = tab();
  assert.match(html, /<div class="beside">\s*<section aria-labelledby="chart-h"[\s\S]*<section aria-labelledby="groups-h"[^>]*>[\s\S]*class="table-wrap"/);
});

const fold = (html) => html.match(/<details class="block-fold history">[\s\S]*?<\/details>/)?.[0] ?? '';

test('runs on other eval sets are folded below the table, newest first, each naming its eval set', () => {
  const oldest = { ...otherSet, run: 'oldest', date: '2026-11-01T10:00:00Z' };
  const html = tab({ runs: [entry, oldest, otherSet] });
  assert.ok(html.indexOf('runs-h') < html.indexOf('block-fold history'));
  assert.match(text(fold(html)), /Runs on other eval sets · 2/);
  assert.deepEqual(
    [...fold(html).matchAll(/<tbody>[\s\S]*<\/tbody>/g)].flatMap(([body]) => [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]).map(([, row]) =>
      [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => text(cell)),
    ),
    [
      ['3 Nov 2026, 10:00', 'promo-kinds-v1', 'claude-haiku-5.5', 'promo-kinds-reviewed-v1 · promo-kinds-v0 · 9 promos', '66.7% (6 of 9)', '11.1% (1 of 9)'],
      ['1 Nov 2026, 10:00', 'promo-kinds-v1', 'claude-haiku-5.5', 'promo-kinds-reviewed-v1 · promo-kinds-v0 · 9 promos', '66.7% (6 of 9)', '11.1% (1 of 9)'],
    ],
  );
});

test('a run in the history links its run page, with no tick, baseline or difference', () => {
  const history = fold(tab({ runs: [entry, otherSet], base: entry.run }));
  assert.ok(history.includes('href="#/promo-kinds/run/other-set"'));
  assert.doesNotMatch(history, /data-tick|base-button|class="diff/);
});

test('with every run on the current eval set, the history does not show', () => {
  assert.equal(fold(tab({ runs: [entry, older] })), '');
});
