import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderRun } from '../src/run.js';

const REAL = '2026-10-30T165731-google-gemini-2.5-flash-google-gemini-2.5-flash';
const realRun = JSON.parse(
  await readFile(new URL(`./fixtures/${REAL}.json`, import.meta.url), 'utf8'),
);
const copy = () => structuredClone(realRun);
const page = (data = realRun) => renderRun({ flow: 'receipt-lines', run: REAL, data });

const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('the heading gives the date, short commit, flow version, models and receipts', () => {
  const html = page();
  assert.match(html, /<h1[^>]*>Eval run, 30 Oct 2026, 16:57<\/h1>/);
  assert.match(html, /<a [^>]*href="https:\/\/github.com\/no-market\/backend\/commit\/27e9b49710a39b391b194187719b1fc625d17117"[^>]*>27e9b49<\/a>/);
  const all = text(html);
  assert.match(all, /Flow V1/);
  assert.match(all, /Reading google\/gemini-2\.5-flash/);
  assert.match(all, /Kind choice google\/gemini-2\.5-flash/);
  assert.match(all, /3 receipts · 45 lines/);
  assert.match(all, /Failed: 0 of 3 receipts/);
});

// The text of each row of the table in the section headed `heading`: its row
// header and cells, tags stripped.
function rows(html, heading) {
  const start = html.search(new RegExp(`<(h2|summary)[^>]*>${heading}`));
  assert.ok(start >= 0, `a section headed ${heading}`);
  const tbody = html.slice(start).match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) => text(cell)),
  );
}

test('the summary table: errors, warnings, seconds and cost by step', () => {
  assert.deepEqual(rows(page(), 'Summary by step'), [
    ['Errors', '4 (8.9%)', '2', '2', '0'],
    ['Warnings', '22 (48.9%)', '22', '0', '0'],
    ['Seconds / receipt, median', '14.9 s', '8.8 s', '5.4 s', '0.7 s'],
    ['Seconds / receipt, p95', '21.7 s', '11.1 s', '10.0 s', '0.7 s'],
    ['Cost / receipt', '0.55¢', '0.27¢', '0.28¢', '—'],
  ]);
});

test('per receipt: lines, errors, warnings and seconds by step, cost', () => {
  assert.deepEqual(rows(page(), 'Per receipt'), [
    ['Aldi, 23 Sep 2026', '5', '0 · 2 · 0', '0 · 0 · 0', '4.1 · 1.6 · 0.7', '0.33¢'],
    ['Aldi, 23 Oct 2026', '8', '0 · 0 · 0', '2 · 0 · 0', '11.1 · 10.0 · 0.6', '0.38¢'],
    ['Biedronka, 24 Oct 2026', '32', '2 · 0 · 0', '20 · 0 · 0', '8.8 · 5.4 · 0.7', '0.95¢'],
  ]);
});

test('a failed receipt says so and why', () => {
  const data = copy();
  const failed = data.cases[1];
  failed.error = 'ModelError: the model returned no lines';
  failed.lines = [];
  failed.times = null;
  failed.numbers = {
    lines: 0,
    errors: { count: 0, share: null },
    warnings: { count: 0, share: null },
    seconds: null,
    cost_usd: null,
    steps: [],
  };
  data.numbers.failed = 1;
  const [, row] = rows(page(data), 'Per receipt');
  assert.deepEqual(row, ['Aldi, 23 Oct 2026', 'Failed: ModelError: the model returned no lines']);
  assert.match(text(page(data)), /Failed: 1 of 3 receipts/);
});

test('errors, a row each: a new kind marked as new, a lost purchase as a dash with its reason', () => {
  const html = page();
  assert.match(html, /<h2[^>]*>Errors <span[^>]*>· 4<\/span><\/h2>/);
  assert.deepEqual(rows(html, 'Errors'), [
    ['Aldi, 23 Sep 2026', 'kind choice', 'GOLONKA Z INDYKA KG', 'GOLONKA Z INDYKA KG', 'new: Golonka z indyka', 'Indyk'],
    ['Aldi, 23 Sep 2026', 'kind choice', 'GOLONKA Z INDYKA KG', 'GOLONKA Z INDYKA KG', '— (no answer)', 'Indyk'],
    ['Biedronka, 24 Oct 2026', 'reading', 'PrzyCzosKamis16-20g', 'PrzyszCzosKanis16-20g', 'new: Przyprawa', 'Czosnek granulowany'],
    ['Biedronka, 24 Oct 2026', 'reading', 'ĆwKurChoB Anty kg', 'CukrChob Anty kg', 'Cukier biały', 'Kurczak'],
  ]);
  assert.match(html, /<span class="new">new<\/span>: Golonka z indyka/);
});

test('a line the reading missed is an error recorded as a dash, not read', () => {
  const data = copy();
  const line = data.cases[0].lines[0];
  Object.assign(line, { read: null, recorded: null, verdict: 'error', step: 'read', mistake: 'no_result' });
  const [first] = rows(page(data), 'Errors');
  assert.deepEqual(first, ['Aldi, 23 Sep 2026', 'reading', 'SOK POMIDOR 1L', '—', '— (not read)', 'Sok pomidorowy']);
});

test('expected: a new kind marked as new, noise as a dash with its reason', () => {
  const data = copy();
  const [sok, ritter] = data.cases[0].lines;
  Object.assign(sok, { expected: 'new', verdict: 'error', step: 'choose_kinds' });
  Object.assign(ritter, { expected: 'noise', label: null, verdict: 'error', step: 'choose_kinds' });
  const [first, second] = rows(page(data), 'Errors');
  assert.equal(first.at(-1), 'new: Sok pomidorowy');
  assert.equal(second.at(-1), '— (noise)');
});

test('a link to the run file, and none to Logfire', () => {
  const html = page();
  assert.match(html, new RegExp(`<a href="https://github.com/no-market/eval-board/blob/main/runs/${REAL}\\.json">Run file on GitHub</a>`));
  assert.doesNotMatch(html, /logfire/i);
});

test('a run that does not exist says so, with a link back to the tab', () => {
  const html = renderRun({ flow: 'receipt-lines', run: 'no-such-run', data: null });
  assert.match(text(html), /There is no eval run no-such-run\. Back to Receipt lines/);
  assert.match(html, /<a href="#\/receipt-lines">Back to Receipt lines<\/a>/);
});

test('text from a run file is escaped', () => {
  const data = copy();
  data.cases[0].lines[2].recorded.kind = '<img src=x>';
  assert.match(page(data), /new<\/span>: &lt;img src=x&gt;/);
});

test('warnings: the same table, folded', () => {
  const html = page();
  const details = html.match(/<details[^>]*>[\s\S]*<\/details>/)?.[0];
  assert.ok(details, 'warnings are in a <details>');
  assert.doesNotMatch(details, /<details[^>]* open/);
  assert.match(text(details), /^Warnings · 22 \(all reading\)/);
  const warnings = rows(html, 'Warnings');
  assert.equal(warnings.length, 22);
  assert.deepEqual(warnings.slice(0, 2), [
    ['Aldi, 23 Oct 2026', 'reading', 'JAJA 10L ŚCIÓŁKOWE', 'JAJA 10L ŚCIÓŁKOWE · discounts none, printed -5.80', 'Jaja', 'Jaja'],
    ['Aldi, 23 Oct 2026', 'reading', '—', 'OPUST JAJA 10L ŚCIÓŁKOWE', '— (noise)', '—'],
  ]);
});
