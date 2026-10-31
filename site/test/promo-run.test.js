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

const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

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
