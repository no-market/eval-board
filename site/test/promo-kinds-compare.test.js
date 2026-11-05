import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise } from '../build/summarise.js';
import { comparedRuns } from '../src/compare.js';
import { viewsOf } from '../src/views.js';

const FLOW = 'promo-kinds';
const ID = '20261104T160000000000-promo-kinds';
const fixture = JSON.parse(await readFile(new URL(`./fixtures/${ID}.json`, import.meta.url), 'utf8'));

// The older run: of the fixture's promos, kinds-002 and kinds-005 were right
// and kinds-008 an error, so B is worse on two and better on one. 7 of 9 in
// error, 1 second slower a promo, $0.0090 in all.
const changes = {
  'kinds-002': { verdict: 'right', errors: [], answer: { outcome: 'kinds', kinds: ['Pieprz'], new_kinds: [] } },
  'kinds-005': { verdict: 'right', warnings: [], answer: { outcome: 'kinds', kinds: ['Ser tarty'], new_kinds: [] } },
  'kinds-008': { verdict: 'error', errors: ['extra_kind'], answer: { outcome: 'kinds', kinds: ['Ser'], new_kinds: [] } },
};
const older = {
  ...fixture,
  date: '2026-11-04T10:00:00.000000Z',
  model: 'google/gemini-2.5-flash',
  cases: fixture.cases.map((c) => ({ ...c, ...changes[c.id] })),
  totals: { ...fixture.totals, errors: { count: 7, share: 7 / 9 }, p50_seconds: 3, cost_usd: 0.009, known_cost_usd: 0.009 },
  by_group: { ...fixture.by_group, unclear: { ...fixture.by_group.unclear, errors: { count: 1, share: 1 } } },
};

const compare = (a = older, b = fixture) => viewsOf(FLOW).compare({ flow: FLOW, a: { id: 'older', run: a }, b: { id: ID, run: b } });

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const section = (html, id) => html.match(new RegExp(`<section aria-labelledby="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
const rows = (html) =>
  [...(html.match(/<tbody[\s\S]*<\/tbody>/)?.[0] ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, cell]) => text(cell)),
  );

test('the heading names the eval set both runs are on, with a card linking each run', () => {
  const html = compare();
  const all = text(html);
  assert.match(all, /Both on the eval set promo-kinds-reviewed-v1 · promo-kinds-v1 · 9 promos/);
  assert.match(all, /A 4 Nov 2026, 10:00 older promo-kinds-v1 · gemini-2\.5-flash commit a6dd332 · 9 promos \(1 failed\)/);
  assert.match(all, /B 4 Nov 2026, 16:00 newer promo-kinds-v1 · claude-haiku-5\.5/);
  assert.ok(html.includes('href="#/promo-kinds/run/older"'));
  assert.ok(html.includes(`href="#/promo-kinds/run/${ID}"`));
});

test('the numbers: A, B and B − A for the total, in promos and points, seconds and cents', () => {
  const [total] = rows(section(compare(), 'summary-h'));
  assert.deepEqual(total, [
    'Total',
    '77.8% (7 of 9)',
    '66.7% (6 of 9)',
    '▼ −1 promo · −11.1 pts',
    '11.1% (1 of 9)',
    '11.1% (1 of 9)',
    '±0',
    '3.0 s',
    '2.0 s',
    '▼ −1.0 s · −33%',
    '0.100¢',
    '0.080¢',
    '▼ −0.020¢ · −20%',
  ]);
});

test('the numbers: a row per group, from each run’s own', () => {
  const [, ...groups] = rows(section(compare(), 'summary-h'));
  assert.deepEqual(groups.map((row) => row[0]), [
    'kind-boundaries',
    'new-kind',
    'one-kind',
    'out-of-scope',
    'pet-household',
    'range-many-kinds',
    'unclear',
  ]);
  assert.deepEqual(groups.at(-1).slice(1, 4), ['100.0% (1 of 1)', '0.0% (0 of 1)', '▼ −1 promo · −100.0 pts']);
});

test('a group one run lacks is a dash, with no difference', () => {
  const { unclear, ...others } = older.by_group;
  const row = rows(section(compare({ ...older, by_group: others }), 'summary-h')).at(-1);
  assert.deepEqual(row.slice(0, 4), ['unclear', '—', '0.0% (0 of 1)', '']);
});

test('cost shows no difference when either run’s cost is not known in full', () => {
  const unpriced = { ...older, totals: { ...older.totals, cost_usd: null } };
  const [total] = rows(section(compare(unpriced), 'summary-h'));
  assert.deepEqual(total.slice(-3), ['≥ 0.100¢', '0.080¢', '']);
});

test('the promos that changed verdict, worse then better, paired by id', () => {
  const html = section(compare(), 'changed-h');
  assert.match(text(html), /Changed promos · worse 2 · better 1/);
  assert.match(text(html), /6 promos unchanged/);
  assert.deepEqual(rows(html), [
    ['▲ Worse in B · 2 promos'],
    ['Wszystkie przyprawy Bolinero range-many-kinds · Kaufland', 'certain Pieprz may cover Papryka mielona, Bazylia', 'right Pieprz', 'error missed_kind missed Pieprz Papryka mielona'],
    ['Sery tarte Mlekovita new-kind · Biedronka', 'certain Ser tarty', 'right Ser tarty', 'warning new_kind_name new Sery tarte'],
    ['▼ Better in B · 1 promo'],
    ['Wybrane produkty marki Pilos unclear · Kaufland', 'Unclear may cover Mleko, Jogurt', 'error extra_kind extra Ser Ser', 'right I don’t know'],
  ]);
});

test('the page says a difference may hold an accepted alternative', () => {
  assert.match(text(section(compare(), 'changed-h')), /accepted alternative/);
});

test('promos pair by id, whatever their order in the run file', () => {
  const reversed = { ...fixture, cases: [...fixture.cases].reverse() };
  assert.match(text(section(compare(older, reversed), 'changed-h')), /worse 2 · better 1/);
});

test('runs with no changed verdict say so', () => {
  const html = section(compare(fixture, fixture), 'changed-h');
  assert.match(text(html), /No promo’s verdict changed/);
  assert.match(text(html), /9 promos unchanged/);
  assert.doesNotMatch(html, /<table/);
});

test('the comparison says the eval set is made of hard cases', () => {
  assert.match(text(compare()), /made of hard cases/);
});

test('a pair across eval sets is refused, and two runs of one eval set are compared', () => {
  const index = {
    runs: [
      summarise(`${ID}.json`, fixture),
      summarise('older.json', older),
      summarise('other-set.json', { ...fixture, date: '2026-11-03T10:00:00.000000Z', scorer_version: 'promo-kinds-v0' }),
    ],
  };
  const route = (a, b) => ({ view: 'compare', flow: FLOW, a, b });
  assert.equal(comparedRuns(route(ID, 'older'), index).a.run, 'older');
  assert.match(comparedRuns(route(ID, 'other-set'), index).message, /different eval sets, .* 9 promos and .* 9 promos; only two runs of one eval set compare/);
});

test('wording from a run file is escaped', () => {
  const name = (run) => ({ ...run, cases: run.cases.map((c) => (c.id === 'kinds-002' ? { ...c, name: '<img src=x>' } : c)) });
  const html = compare(name(older), name(fixture));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<img src=x>'));
});
