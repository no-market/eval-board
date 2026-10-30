import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { comparedRuns, renderCompare } from '../src/compare.js';

const REAL = '2026-10-30T165731-google-gemini-2.5-flash-google-gemini-2.5-flash';
const realRun = JSON.parse(
  await readFile(new URL(`./fixtures/${REAL}.json`, import.meta.url), 'utf8'),
);

// The text of an element, tags stripped and white space collapsed.
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Run B, the real run with a fourth receipt; run A, an older run on its three
// receipts with another model, its numbers by hand.
const B = {
  id: REAL,
  run: {
    ...realRun,
    numbers: { ...realRun.numbers, receipts: 4 },
    cases: [...realRun.cases, { ...realRun.cases[0], receipt: 'lidl/2026-10-28 10.00.jpg' }],
  },
};
const A = {
  id: '2026-10-29T194800-lite',
  run: {
    ...realRun,
    date: '2026-10-29T19:48:00Z',
    commit: '2104219aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    steps: {
      read: { model: 'google/gemini-3.5-flash-lite', options: {} },
      choose_kinds: { model: 'google/gemini-3.5-flash-lite', options: {} },
    },
    numbers: {
      receipts: 3,
      failed: 1,
      lines: 45,
      errors: { count: 13, share: 13 / 45 },
      warnings: { count: 22, share: 22 / 45 },
      seconds: { median_s: 5.8, p95_s: 16.5 },
      cost_usd: 0.0067,
      steps: [
        { step: 'read', errors: { count: 12, share: 12 / 45 }, warnings: { count: 22, share: 22 / 45 }, seconds: { median_s: 2.5, p95_s: 5.3 }, cost_usd: 0.0029 },
        { step: 'choose_kinds', errors: { count: 1, share: 1 / 45 }, warnings: { count: 0, share: 0 }, seconds: { median_s: 2.1, p95_s: 4.4 }, cost_usd: 0.0038 },
        { step: 'database', errors: { count: 0, share: 0 }, warnings: { count: 0, share: 0 }, seconds: { median_s: 1.5, p95_s: 6.8 }, cost_usd: null },
      ],
    },
  },
};

test('the heading shows A and B: date, short commit, flow version, models, receipts', () => {
  const html = renderCompare({ flow: 'receipt-lines', a: A, b: B });
  const cards = [...html.matchAll(/<a class="run-card"[^>]*>([\s\S]*?)<\/a>/g)].map(([, card]) => text(card));
  assert.deepEqual(cards, [
    'A 29 Oct 2026, 19:48 older V1 · gemini-3.5-flash-lite · gemini-3.5-flash-lite commit 2104219 · 3 receipts (1 failed) · 45 lines',
    'B 30 Oct 2026, 16:57 newer V1 · gemini-2.5-flash · gemini-2.5-flash commit 27e9b49 · 4 receipts · 45 lines',
  ]);
  assert.match(html, new RegExp(`<a class="run-card" href="#/receipt-lines/run/${REAL}"`));
});

test('when the receipts differ, the heading says how many are shared', () => {
  const html = renderCompare({ flow: 'receipt-lines', a: A, b: B });
  assert.match(text(html), /A: 3 receipts · B: 4 receipts · 3 shared\./);
});

test('when the receipts are the same, the heading says so', () => {
  const html = renderCompare({ flow: 'receipt-lines', a: A, b: { id: REAL, run: realRun } });
  assert.match(text(html), /Both runs: the same 3 receipts\./);
  assert.doesNotMatch(text(html), /shared/);
});

const older = { run: 'older', flow: 'receipt-lines', date: '2026-10-29T19:48:00Z' };
const newer = { run: 'newer', flow: 'receipt-lines', date: '2026-10-30T16:57:31Z' };
const promo = { run: 'promo', flow: 'promos', date: '2026-10-30T18:35:42Z' };
const index = { runs: [promo, newer, older] };

test('routing: a compare address finds both runs in the index, A the older', () => {
  const route = { view: 'compare', flow: 'receipt-lines', a: 'older', b: 'newer' };
  assert.deepEqual(comparedRuns(route, index), { a: older, b: newer });
});

test('routing: a compare address naming the newer run first still makes A the older', () => {
  const route = { view: 'compare', flow: 'receipt-lines', a: 'newer', b: 'older' };
  assert.deepEqual(comparedRuns(route, index), { a: older, b: newer });
});

test('routing: a compare address naming an unknown run says so', () => {
  const route = { view: 'compare', flow: 'receipt-lines', a: 'older', b: 'gone' };
  assert.deepEqual(comparedRuns(route, index), { message: 'There is no run gone to compare.' });
});

test('routing: two runs of different flows say they can’t be compared', () => {
  const route = { view: 'compare', flow: 'receipt-lines', a: 'older', b: 'promo' };
  assert.deepEqual(comparedRuns(route, index), {
    message: 'The runs older and promo are of different flows, receipt-lines and promos; only runs of one flow compare.',
  });
});

// The summary's body rows: the row's name, then A, B and B − A for each of
// total, reading, kind choice and database; and each difference's mark.
function summaryRows(html) {
  const section = html.match(/<section[^>]*class="summary"[\s\S]*?<\/section>/)?.[0] ?? '';
  const tbody = section.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) => text(cell)),
  );
}
function summaryMarks(html) {
  const section = html.match(/<section[^>]*class="summary"[\s\S]*?<\/section>/)?.[0] ?? '';
  const tbody = section.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<td class="diff (\w+)/g)].map(([, mark]) => mark),
  );
}

test('the summary shows A, B and the difference by step, from each run file as it is', () => {
  const html = renderCompare({ flow: 'receipt-lines', a: A, b: B });
  assert.deepEqual(summaryRows(html), [
    ['Errors',
      '13 (28.9%)', '4 (8.9%)', '▼ −9 lines · −20.0 pts',
      '12 (26.7%)', '2 (4.4%)', '▼ −10 lines · −22.2 pts',
      '1 (2.2%)', '2 (4.4%)', '▲ +1 line · +2.2 pts',
      '0 (0.0%)', '0 (0.0%)', '±0'],
    ['Warnings',
      '22 (48.9%)', '22 (48.9%)', '±0',
      '22 (48.9%)', '22 (48.9%)', '±0',
      '0 (0.0%)', '0 (0.0%)', '±0',
      '0 (0.0%)', '0 (0.0%)', '±0'],
    ['Seconds, median',
      '5.8 s', '14.9 s', '▲ +9.1 s · ×2.6',
      '2.5 s', '8.8 s', '▲ +6.3 s · ×3.5',
      '2.1 s', '5.4 s', '▲ +3.3 s · ×2.6',
      '1.5 s', '0.7 s', '▼ −0.8 s · −54%'],
    ['Seconds, p95',
      '16.5 s', '21.7 s', '▲ +5.2 s · +31%',
      '5.3 s', '11.1 s', '▲ +5.8 s · ×2.1',
      '4.4 s', '10.0 s', '▲ +5.6 s · ×2.3',
      '6.8 s', '0.7 s', '▼ −6.1 s · −90%'],
    ['Cost / receipt',
      '0.67¢', '0.55¢', '▼ −0.12¢ · −17%',
      '0.29¢', '0.27¢', '▼ −0.02¢ · −6%',
      '0.38¢', '0.28¢', '▼ −0.10¢ · −26%',
      '—', '—', ''],
    ['Cost / 100 receipts',
      '$0.67', '$0.55', '▼ −$0.12',
      '$0.29', '$0.27', '▼ −$0.02',
      '$0.38', '$0.28', '▼ −$0.10',
      '—', '—', ''],
  ]);
});

test('each difference in the summary is marked better, worse or the same', () => {
  const html = renderCompare({ flow: 'receipt-lines', a: A, b: B });
  const marks = summaryMarks(html);
  assert.deepEqual(marks[0], ['better', 'better', 'worse', 'same']);
  assert.deepEqual(marks[3], ['worse', 'worse', 'worse', 'better']);
  assert.deepEqual(marks[4], ['better', 'better', 'better', 'same']);
});
