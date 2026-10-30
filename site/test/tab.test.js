import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise } from '../build/summarise.js';
import { renderTab } from '../src/tab.js';

const REAL = '2026-10-30T165731-google-gemini-2.5-flash-google-gemini-2.5-flash';
const realRun = JSON.parse(
  await readFile(new URL(`./fixtures/${REAL}.json`, import.meta.url), 'utf8'),
);
const entry = summarise(`${REAL}.json`, realRun);

// The text of each body row's cells, tags stripped and white space collapsed.
function bodyRows(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) =>
      cell.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    ),
  );
}

test('the table shows the cells of the real fixture run', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry] });
  assert.deepEqual(bodyRows(html), [
    [
      '',
      '30 Oct 2026, 16:57',
      'V1 · gemini-2.5-flash · gemini-2.5-flash',
      '3',
      '8.9% (4 of 45)',
      '48.9% (22 of 45)',
      '14.9 s',
      '0.55¢',
      'Set as baseline',
    ],
  ]);
});

test('the date links to the run page', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry] });
  assert.match(html, new RegExp(`<a href="#/receipt-lines/run/${REAL}">30 Oct 2026, 16:57</a>`));
});

test('a row per run, in the order of the index', () => {
  const older = { ...entry, run: 'older', date: '2026-10-29T12:54:00Z' };
  const rows = bodyRows(renderTab({ flow: 'receipt-lines', runs: [entry, older] }));
  assert.deepEqual(rows.map((cells) => cells[1]), ['30 Oct 2026, 16:57', '29 Oct 2026, 12:54']);
});

test('the heading is in the flow colour, under a tab bar of the flows', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry] });
  assert.match(html, /<h1 style="color: #0F6E6E">Receipt lines<\/h1>/);
  assert.match(html, /<nav aria-label="Flows">[\s\S]*<a href="#\/receipt-lines" aria-current="page"[\s\S]*Receipt lines<\/a>[\s\S]*<\/nav>/);
});

test('a flow with no runs says there are no runs yet', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [] });
  assert.match(html, /No eval runs yet/);
  assert.doesNotMatch(html, /<table/);
});

// The real run, and an older one to set as the baseline: 9 of 45 errors,
// 20 of 43 warnings, 7.8 s and 0.66¢ per receipt.
const older = {
  ...entry,
  run: 'older',
  date: '2026-10-29T22:32:00Z',
  lines: 43,
  errors: { count: 9, share: 9 / 43 },
  warnings: { count: 20, share: 20 / 43 },
  seconds: { median: 7.8, p95: 9 },
  costUsd: 0.0066,
};

// The differences under the numbers of each body row, as [mark, text].
function differences(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<div class="diff (\w+)">([^<]*)<\/div>/g)].map(([, mark, text]) => [mark, text]),
  );
}

test('with no baseline, no differences show and a hint says how to set one', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older] });
  assert.deepEqual(differences(html), [[], []]);
  assert.match(html, /Set a baseline/);
  assert.match(html, /<a class="base-button" href="#\/receipt-lines\?base=older"[^>]*>Set as baseline<\/a>/);
});

test('under each number of a non-baseline row, its difference from the baseline', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older], base: 'older' });
  assert.deepEqual(differences(html), [
    [
      ['better', '▼ −5 lines · −12.0 pts'],
      ['worse', '▲ +2 lines · +2.4 pts'],
      ['worse', '▲ +7.1 s · +91%'],
      ['better', '▼ −0.11¢ · −16%'],
    ],
    [],
  ]);
  assert.match(html, /Differences against the baseline, 29 Oct 2026, 22:32/);
});

test('the baseline row is marked, and its button clears the baseline', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older], base: 'older' });
  assert.match(html, /<tr class="base">/);
  assert.match(html, /<a class="base-button" href="#\/receipt-lines" aria-pressed="true"[^>]*>Baseline ✕<\/a>/);
});

test('text from a run file is escaped', () => {
  const html = renderTab({
    flow: 'receipt-lines',
    runs: [{ ...entry, flowVersion: '<b>V1</b>' }],
  });
  assert.match(html, /&lt;b&gt;V1&lt;\/b&gt;/);
});

// Each row's box, as [run, ticked].
function boxes(html) {
  return [...html.matchAll(/<input type="checkbox" data-tick="([^"]+)"([^>]*)>/g)].map(([, run, rest]) => [
    run,
    / checked/.test(rest),
  ]);
}

test('each row has a box for comparing, ticked for the ticked runs', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older], ticked: ['older'] });
  assert.deepEqual(boxes(html), [[REAL, false], ['older', true]]);
  assert.match(html, /<input type="checkbox" data-tick="older" checked aria-label="Compare the run of 29 Oct 2026, 22:32"/);
});

test('with fewer than two runs ticked, the compare button is disabled', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older], ticked: ['older'] });
  assert.match(html, /1 of 2 runs ticked/);
  assert.match(html, /<button type="button" class="compare-button" disabled>Tick 2 runs to compare<\/button>/);
});

test('with two runs ticked, a button opens their comparison, A the older', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older], ticked: [REAL, 'older'] });
  assert.match(html, /2 runs ticked/);
  assert.match(html, new RegExp(`<a class="compare-button" href="#/receipt-lines/compare/older/${REAL}">Compare 2 runs</a>`));
});
