import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { viewsOf } from '../src/views.js';

const FLOW = 'promo-kinds';
const ID = '20261104T160000000000-promo-kinds';
const runFile = JSON.parse(await readFile(new URL(`./fixtures/${ID}.json`, import.meta.url), 'utf8'));

// A promo kinds run page, opened as main.js opens it.
const page = (file = runFile, id = ID) => viewsOf(FLOW).run({ flow: FLOW, id, runFile: file });

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const section = (html, id) => html.match(new RegExp(`<section aria-labelledby="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
// Each row of a section's body, its cells' text.
const rows = (html) =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(([, row]) => [...row.matchAll(/<t[dh](?! scope="col")[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, cell]) => text(cell)))
    .filter((cells) => cells.length > 0);

test('a missing run shows the not-found page', () => {
  const html = viewsOf(FLOW).run({ flow: FLOW, id: 'r1', runFile: undefined });
  assert.match(html, /There is no eval run r1/);
  assert.match(html, /href="#\/promo-kinds"/);
});

test('the heading: prompt, model, commit, dataset and scorer, promos, failed promos', () => {
  const html = page();
  assert.match(html, /<h1[^>]*>Promo kinds eval run, 4 Nov 2026, 16:00<\/h1>/);
  assert.match(html, /href="https:\/\/github.com\/no-market\/backend\/commit\/a6dd3320000000000000000000000000000000ab"[^>]*>a6dd332<\/a>/);
  const all = text(html);
  assert.match(all, /Prompt promo-kinds-v1/);
  assert.match(all, /Model claude-haiku-5\.5/);
  assert.match(all, /Dataset promo-kinds-reviewed-v1 · scorer promo-kinds-v1/);
  assert.match(all, /9 of 9 promos, full/);
  assert.match(all, /Failed: 1 of 9 promos/);
});

test('a run of part of the eligible promos says it is not full', () => {
  assert.match(text(page({ ...runFile, selection: runFile.selection.slice(0, 2), full: false })), /2 of 9 promos, not full/);
});

test('the table of errors, warnings, seconds and cost', () => {
  assert.deepEqual(rows(section(page(), 'summary-h')), [
    ['Errors', '66.7% (6 of 9)'],
    ['Warnings', '11.1% (1 of 9)'],
    ['Seconds per promo, median (p95)', '2.0 s (3.0 s)'],
    ['Cost per promo', '0.080¢'],
  ]);
});

test('cost per promo is marked ≥ when some calls were not priced', () => {
  const unpriced = { ...runFile, totals: { ...runFile.totals, cost_usd: null } };
  assert.equal(rows(section(page(unpriced), 'summary-h')).at(-1)[1], '≥ 0.080¢');
});

test('the note on hard cases comes after the table', () => {
  const html = page();
  assert.ok(html.indexOf('summary-h') < html.indexOf('made of hard cases'));
  assert.ok(html.indexOf('made of hard cases') < html.indexOf('groups-h'));
});

test('errors by group: each group’s promos, errors and warnings', () => {
  assert.deepEqual(rows(section(page(), 'groups-h')), [
    ['kind-boundaries', '1', '100.0% (1 of 1)', '0.0% (0 of 1)'],
    ['new-kind', '2', '50.0% (1 of 2)', '50.0% (1 of 2)'],
    ['one-kind', '2', '50.0% (1 of 2)', '0.0% (0 of 2)'],
    ['out-of-scope', '1', '100.0% (1 of 1)', '0.0% (0 of 1)'],
    ['pet-household', '1', '100.0% (1 of 1)', '0.0% (0 of 1)'],
    ['range-many-kinds', '1', '100.0% (1 of 1)', '0.0% (0 of 1)'],
    ['unclear', '1', '0.0% (0 of 1)', '0.0% (0 of 1)'],
  ]);
});

test('errors: each promo in error, with its group and chain, reasons, difference, expected and answered kinds', () => {
  const html = section(page(), 'errors-h');
  assert.match(text(html), /Errors · 6/);
  assert.deepEqual(rows(html), [
    ['Wszystkie przyprawy Bolinero range-many-kinds · Kaufland', 'missed_kind', 'missed Pieprz', 'certain Pieprz may cover Papryka mielona, Bazylia', 'Papryka mielona'],
    ['Parówki Tarczyński kind-boundaries · Lidl', 'extra_kind', 'extra Kiełbasa', 'certain Parówki', 'Parówki, Kiełbasa'],
    ['Wiertarka Parkside out-of-scope · Aldi', 'scope', '', 'Out of scope', 'new Wiertarka'],
    ['Kefir Bakoma new-kind · Lidl', 'new_instead_of_stored', '', 'certain Kefir', 'new Kefir naturalny'],
    ['Karma dla kota Whiskas pet-household · Aldi', 'unknown', '', 'certain Karma dla kota', 'I don’t know'],
    ['Masło Mleczna Dolina one-kind · Aldi', 'failed', '', 'certain Masło', 'Failed: no_valid_kind'],
  ]);
});

test('an unclear promo in error shows it was unclear and what it may cover', () => {
  const cases = runFile.cases.map((c) => (c.id === 'kinds-008' ? { ...c, verdict: 'error', errors: ['extra_kind'], answer: { outcome: 'kinds', kinds: ['Ser'], new_kinds: [] } } : c));
  const row = rows(section(page({ ...runFile, cases }), 'errors-h')).find(([promo]) => promo.startsWith('Wybrane'));
  assert.equal(row[2], 'extra Ser');
  assert.equal(row[3], 'Unclear may cover Mleko, Jogurt');
  assert.equal(row[4], 'Ser');
});

test('an answer out of scope is said in words', () => {
  const cases = runFile.cases.map((c) => (c.id === 'kinds-001' ? { ...c, verdict: 'error', errors: ['scope'], answer: { outcome: 'out_of_scope', kinds: [], new_kinds: [] } } : c));
  const row = rows(section(page({ ...runFile, cases }), 'errors-h')).find(([promo]) => promo.startsWith('Milka'));
  assert.equal(row[4], 'Out of scope');
});

test('an answer with stored and new kinds names both', () => {
  const cases = runFile.cases.map((c) => (c.id === 'kinds-002' ? { ...c, answer: { outcome: 'kinds', kinds: ['Pieprz'], new_kinds: ['Bazylia suszona'] } } : c));
  assert.equal(rows(section(page({ ...runFile, cases }), 'errors-h'))[0][4], 'Pieprz new Bazylia suszona');
});

test('a difference ignores case and diacritics, and a new kind can be extra', () => {
  const answer = { outcome: 'kinds', kinds: ['PARÓWKI'], new_kinds: ['Parowki roslinne'] };
  const cases = runFile.cases.map((c) => (c.id === 'kinds-003' ? { ...c, answer, errors: ['missed_kind', 'extra_kind'] } : c));
  const row = rows(section(page({ ...runFile, cases }), 'errors-h')).find(([promo]) => promo.startsWith('Parówki'));
  assert.equal(row[2], 'extra Parowki roslinne');
});

test('the page says a difference may hold an accepted alternative', () => {
  assert.match(text(section(page(), 'errors-h')), /accepted alternative/);
});

// A range of 30 kinds, all answered but one, with another extra.
const spices = Array.from({ length: 30 }, (_, i) => `Kind ${i + 1}`);
const range = {
  expected: { outcome: 'kinds', certain: [], possible: spices },
  answer: { outcome: 'kinds', kinds: [...spices.slice(1), 'Sól'], new_kinds: [] },
  errors: ['extra_kind'],
};

test('a long list folds, with its count, and its difference stays plain', () => {
  const cases = runFile.cases.map((c) => (c.id === 'kinds-002' ? { ...c, ...range } : c));
  const html = section(page({ ...runFile, cases }), 'errors-h');
  assert.equal(rows(html)[0][2], 'extra Sól');
  assert.match(text(html), /may cover 30 kinds Kind 1, Kind 2/);
  assert.match(html, /<details class="kinds"><summary><span class="muted">may cover<\/span> 30 kinds<\/summary>/);
  assert.match(html, /<details class="kinds"><summary>30 kinds<\/summary>/);
});

test('a difference never folds, however long, as it says what is wrong', () => {
  const salts = Array.from({ length: 13 }, (_, i) => `Sól ${i + 1}`);
  const answer = { outcome: 'kinds', kinds: [...spices, ...salts], new_kinds: [] };
  const cases = runFile.cases.map((c) => (c.id === 'kinds-002' ? { ...c, ...range, answer } : c));
  assert.equal(rows(section(page({ ...runFile, cases }), 'errors-h'))[0][2], `extra ${salts.join(', ')}`);
});

test('warnings are folded, each as the truth’s name to the created name', () => {
  const html = page().match(/<details class="block-fold">[\s\S]*?<\/details>/)[0];
  assert.match(text(html), /Warnings · 1/);
  assert.deepEqual(rows(html), [['Sery tarte Mlekovita new-kind · Biedronka', 'new_kind_name', 'Ser tarty', 'Sery tarte']]);
});

test('a warning shows only the renamed pair, not the promo’s other kinds', () => {
  const cases = runFile.cases.map((c) =>
    c.id === 'kinds-005'
      ? {
          ...c,
          expected: { outcome: 'kinds', certain: ['Ser tarty', 'Ser żółty'], possible: ['Ser tarty', 'Ser żółty'] },
          answer: { outcome: 'kinds', kinds: ['Ser żółty'], new_kinds: ['Sery tarte'] },
        }
      : c,
  );
  const html = page({ ...runFile, cases }).match(/<details class="block-fold">[\s\S]*?<\/details>/)[0];
  assert.deepEqual(rows(html)[0].slice(2), ['Ser tarty', 'Sery tarte']);
});

test('a run with no errors and no warnings says so, with no empty tables', () => {
  const cases = runFile.cases.map((c) => ({ ...c, verdict: 'right', errors: [], warnings: [] }));
  const html = page({ ...runFile, cases });
  assert.match(text(html), /No promo has an error/);
  assert.match(text(html), /No promo has a warning/);
  assert.doesNotMatch(section(html, 'errors-h'), /<table/);
  assert.doesNotMatch(html.match(/<details class="block-fold">[\s\S]*?<\/details>/)[0], /<table/);
});

test('wording from a run file is escaped', () => {
  const cases = runFile.cases.map((c) => (c.id === 'kinds-002' ? { ...c, name: '<img src=x>' } : c));
  const html = page({ ...runFile, cases });
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<img src=x>'));
});

test('the page links its run file', () => {
  assert.match(page(), new RegExp(`runs/${ID}\\.json`));
});
