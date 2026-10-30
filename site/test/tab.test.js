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
      '30 Oct 2026, 16:57',
      'V1 · gemini-2.5-flash · gemini-2.5-flash',
      '3',
      '8.9% (4 of 45)',
      '48.9% (22 of 45)',
      '14.9 s',
      '0.55¢',
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
  assert.deepEqual(rows.map((cells) => cells[0]), ['30 Oct 2026, 16:57', '29 Oct 2026, 12:54']);
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

test('text from a run file is escaped', () => {
  const html = renderTab({
    flow: 'receipt-lines',
    runs: [{ ...entry, flowVersion: '<b>V1</b>' }],
  });
  assert.match(html, /&lt;b&gt;V1&lt;\/b&gt;/);
});
