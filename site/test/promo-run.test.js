import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { viewsOf } from '../src/views.js';

const FLOW = 'promo-extraction';
const WITH_VERDICTS = '20261031T132616405937-promo';
const WITHOUT_VERDICTS = '20261030T183542318891-promo';
const load = async (id) => JSON.parse(await readFile(new URL(`./fixtures/${id}.json`, import.meta.url), 'utf8'));
const withVerdicts = await load(WITH_VERDICTS);
const withoutVerdicts = await load(WITHOUT_VERDICTS);

// A promo run page, opened as main.js opens it.
const page = (runFile = withVerdicts, id = WITH_VERDICTS) => viewsOf(FLOW).run({ flow: FLOW, id, runFile });

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('a missing promo run shows the not-found page', () => {
  const html = viewsOf(FLOW).run({ flow: FLOW, id: 'r1', runFile: undefined });
  assert.match(html, /There is no eval run r1/);
  assert.match(html, /href="#\/promo-extraction"/);
});

test("the heading: prompt, each chain's model and strategy, commit, dataset and scorer, pages, failed pages", () => {
  const html = page();
  assert.match(html, /<h1[^>]*>Promo eval run, 31 Oct 2026, 13:26<\/h1>/);
  assert.match(html, /<a [^>]*href="https:\/\/github.com\/no-market\/backend\/commit\/6457199dd8883b622c64854a39d2f1c5af817f6f"[^>]*>6457199<\/a>/);
  const all = text(html);
  assert.match(all, /Prompt promo-v4/);
  assert.match(all, /Aldi gemini-2\.5-flash · text/);
  assert.match(all, /Biedronka gemini-2\.5-flash · image/);
  assert.match(all, /Kaufland gemini-2\.5-flash · positioned_text/);
  assert.match(all, /Lidl gemini-2\.5-flash · text/);
  assert.match(all, /Dataset baseline-10-reviewed-v2-context · scorer promo-core-text-v6/);
  assert.match(all, /8 of 8 pages, full/);
  assert.match(all, /Failed: 0 of 8 pages/);
});

// The text of each row of the table in the section headed `heading`: its row
// header and cells, tags stripped.
function rows(html, heading) {
  const start = html.search(new RegExp(`<(h2|summary)[^>]*>${heading}`));
  assert.ok(start >= 0, `a section headed ${heading}`);
  const table = html.slice(start).match(/<table[\s\S]*?<\/table>/)?.[0] ?? '';
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) => text(cell)),
  );
}

test('the summary: errors, warnings, seconds per page median (p95) and cost per page, in total and by chain', () => {
  assert.deepEqual(rows(page(), 'Summary by chain'), [
    ['', 'Total', 'Aldi', 'Biedronka', 'Kaufland', 'Lidl'],
    ['Errors', '9 of 22 (40.9%)', '4 of 6 (66.7%)', '5 of 6 (83.3%)', '0 of 8 (0.0%)', '0 of 2 (0.0%)'],
    ['Warnings', '13 of 22 (59.1%)', '2 of 6 (33.3%)', '1 of 6 (16.7%)', '8 of 8 (100.0%)', '2 of 2 (100.0%)'],
    ['Seconds per page, median (p95)', '2.8 s (4.8 s)', '2.8 s (3.3 s)', '4.5 s (4.8 s)', '1.7 s (3.7 s)', '0.6 s (2.2 s)'],
    ['Cost per page', '0.15¢', '0.17¢', '0.20¢', '0.16¢', '0.07¢'],
  ]);
});

test('a cost with unpriced calls is the priced part, marked ≥', () => {
  const run = structuredClone(withVerdicts);
  run.totals.cost_usd = null;
  run.by_chain.aldi.cost_usd = null;
  run.by_chain.aldi.known_cost_usd = 0.002;
  const [cost] = rows(page(run), 'Summary by chain').filter(([label]) => label === 'Cost per page');
  assert.deepEqual(cost, ['Cost per page', '≥ 0.15¢', '≥ 0.10¢', '0.20¢', '0.16¢', '0.07¢']);
});

test('per page: each page with its leaflet, promos, errors, warnings, seconds and cost', () => {
  assert.deepEqual(rows(page(), 'Per page'), [
    ['Page', 'Promos', 'Errors', 'Warnings', 'Seconds', 'Cost'],
    ['Biedronka p. 4 · leaflet', '3', '3', '0', '4.8 s', '0.21¢'],
    ['Biedronka p. 5 · leaflet', '3', '2', '1', '4.5 s', '0.20¢'],
    ['Aldi p. 2 · leaflet', '3', '1', '2', '2.8 s', '0.15¢'],
    ['Aldi p. 3 · leaflet', '3', '3', '0', '3.3 s', '0.19¢'],
    ['Lidl p. 6 · leaflet', '2', '0', '2', '2.2 s', '0.13¢'],
    ['Kaufland p. 4 · leaflet', '6', '0', '6', '3.7 s', '0.23¢'],
    ['Kaufland p. 5 · leaflet', '2', '0', '2', '1.7 s', '0.09¢'],
    ['Lidl p. 117 · leaflet', '0', '0', '0', '0.6 s', '0.00¢'],
  ]);
});

// The section headed `heading`, up to the next section.
function section(html, heading) {
  const start = html.search(new RegExp(`<(h2|summary)[^>]*>${heading}`));
  assert.ok(start >= 0, `a section headed ${heading}`);
  const rest = html.slice(start);
  return rest.slice(0, rest.search(/<\/(section|details)>/));
}

test("each page links to its own leaflet and nowhere else; no leaflet files or page images show", () => {
  const html = page();
  const links = [...section(html, 'Per page').matchAll(/href="([^"]*)"/g)].map(([, href]) => href);
  assert.deepEqual(links, withVerdicts.cases.map((c) => c.source_url.replaceAll('&', '&amp;')));
  assert.doesNotMatch(html, /<img|<iframe|<object|<embed/);
  assert.doesNotMatch(html, /\.pdf"/);
});

test("a page whose leaflet address isn't a web address has no link", () => {
  const run = structuredClone(withVerdicts);
  run.cases[0].source_url = 'javascript:alert(1)';
  run.cases[1].source_url = null;
  const html = section(page(run), 'Per page');
  assert.doesNotMatch(html, /javascript:/);
  assert.equal([...html.matchAll(/href=/g)].length, withVerdicts.cases.length - 2);
});

test('errors: each promo in error with its page, fields, expected and actual', () => {
  const html = page();
  assert.match(text(html), /Errors · 9/);
  const errors = rows(html, 'Errors');
  assert.equal(errors.length, 1 + 9);
  assert.deepEqual(errors[0], ['Page', 'Promo', 'Fields', 'Expected', 'Actual']);
  assert.deepEqual(errors[2], [
    'Biedronka p. 4 · leaflet',
    'Ser żółty Gouda Światowid, 400 g',
    'conditions.minimum_quantity, price_basis',
    'conditions.minimum_quantity 2 price_basis —',
    'conditions.minimum_quantity — price_basis opak.',
  ]);
});

test('warnings are folded, with the differences under each field named', () => {
  const html = page();
  assert.match(html, /<details class="block-fold">\s*<summary>Warnings · 13<\/summary>/);
  const kawa = rows(html, 'Warnings').find(([, promo]) => promo === 'Kawa rozpuszczalna Krönung Jacobs, 200 g');
  assert.deepEqual(kawa, [
    'Aldi p. 2 · leaflet',
    'Kawa rozpuszczalna Krönung Jacobs, 200 g',
    'condition, lowest_30_days, reference_price',
    'condition Przy zakupie 2 szt.; limit 6 szt. na klienta. lowest_30_days.amount 41.99 lowest_30_days.kind lowest_30_days lowest_30_days.wording najniższa cena z 30 dni przed obniżką reference_price.wording Cena regularna',
    'condition 33% PRZY ZAKUPIE 2 SZT. lowest_30_days.amount — lowest_30_days.kind — lowest_30_days.wording — reference_price.wording Cena regularna /najniższa cena z 30 dni przed obniżką',
  ]);
});

test('a conditions difference shows only the parts that differ', () => {
  // Aldi p. 2: no conditions expected, ten read, of which only the discount is stated.
  const sliwki = rows(page(), 'Errors').find(([, promo]) => promo === 'Śliwki polskie');
  assert.deepEqual(sliwki, [
    'Aldi p. 2 · leaflet',
    'Śliwki polskie',
    'conditions.percentage_discount',
    'conditions.percentage_discount —',
    'conditions.percentage_discount 37',
  ]);
});

test('a missed promo and a made-up one are errors that say so', () => {
  const run = structuredClone(withVerdicts);
  run.cases[0].promos.push(
    { truth: 'biedronka-j2givjdmw-p004-o009', prediction: null, name: 'Masło', verdict: 'error', errors: [], warnings: [] },
    { truth: null, prediction: 7, name: 'Chleb', verdict: 'error', errors: [], warnings: [] },
  );
  const errors = rows(page(run), 'Errors');
  assert.deepEqual(errors.find(([, promo]) => promo === 'Masło'), ['Biedronka p. 4 · leaflet', 'Masło', '', 'on the page', '— (missed)']);
  assert.deepEqual(errors.find(([, promo]) => promo === 'Chleb'), ['Biedronka p. 4 · leaflet', 'Chleb', '', '— (not on the page)', 'made up']);
});

test('a run with verdicts shows the heading, summary, pages, errors and folded warnings, in that order', () => {
  const html = page();
  const at = (pattern) => html.search(pattern);
  const order = [/<h1/, /<h2[^>]*>Summary by chain/, /<h2[^>]*>Per page/, /<h2[^>]*>Errors/, /<summary>Warnings/].map(at);
  assert.ok(order.every((i) => i >= 0), 'every part is there');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('a run without verdicts: matched, missed, made-up, recall and precision in the table', () => {
  const html = page(withoutVerdicts, WITHOUT_VERDICTS);
  assert.deepEqual(rows(html, 'Summary by chain'), [
    ['', 'Total', 'Aldi', 'Biedronka', 'Kaufland', 'Lidl', 'Netto'],
    ['Matched', '20 of 40', '1 of 6', '3 of 6', '7 of 8', '0 of 2', '9 of 18'],
    ['Missed', '20', '5', '3', '1', '2', '9'],
    ['Made up', '21', '5', '3', '0', '2', '11'],
    ['Recall', '50.0%', '16.7%', '50.0%', '87.5%', '0.0%', '50.0%'],
    ['Precision', '48.8%', '16.7%', '50.0%', '100.0%', '0.0%', '45.0%'],
    ['Seconds per page, median (p95)', '3.9 s (12.5 s)', '3.6 s (3.9 s)', '5.7 s (6.2 s)', '3.3 s (5.4 s)', '0.7 s (2.1 s)', '8.3 s (12.5 s)'],
    ['Cost per page', '0.31¢', '0.22¢', '0.27¢', '0.33¢', '0.06¢', '0.67¢'],
  ]);
});

test('a run without verdicts lists no promos: no errors, no warnings', () => {
  const html = page(withoutVerdicts, WITHOUT_VERDICTS);
  assert.doesNotMatch(html, /<h2[^>]*>Errors/);
  assert.doesNotMatch(html, /Warnings/);
  assert.match(text(html), /Promo eval run, 30 Oct 2026, 18:35/);
  assert.match(text(html), /10 of 10 pages, full/);
});

test('a run without verdicts gives each page its matched, missed and made-up promos', () => {
  const pages = rows(page(withoutVerdicts, WITHOUT_VERDICTS), 'Per page');
  assert.deepEqual(pages[0], ['Page', 'Promos', 'Matched', 'Missed', 'Made up', 'Seconds', 'Cost']);
  assert.deepEqual(pages[1], ['Biedronka p. 4', '3', '2', '1', '1', '5.7 s', '0.23¢']);
  assert.deepEqual(pages[9], ['Netto p. 5', '6', '1', '5', '7', '8.3 s', '0.51¢']);
});

test('a failed page says why; a page with unscored promos says how many', () => {
  const run = structuredClone(withVerdicts);
  Object.assign(run.cases[0], { failed: true, failure: 'Page extraction failed', promos: [] });
  run.cases[1].unscored = ['one', 'two'];
  const [, failed, unscored] = rows(page(run), 'Per page');
  assert.deepEqual(failed, ['Biedronka p. 4 · leaflet', 'Failed: Page extraction failed', '4.8 s', '0.21¢']);
  assert.deepEqual(unscored, ['Biedronka p. 5 · leaflet', '3 · 2 unscored', '2', '1', '4.5 s', '0.20¢']);
});
