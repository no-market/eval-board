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
