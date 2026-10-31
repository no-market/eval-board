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
