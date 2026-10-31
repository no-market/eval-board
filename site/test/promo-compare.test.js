import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { comparedRuns } from '../src/compare.js';
import { viewsOf } from '../src/views.js';

const FLOW = 'promo-extraction';
const SET = { dataset: 'baseline-10', scorer: 'promo-core-text-v6', selection: ['aldi-p002', 'lidl-p006'] };
const OTHER_SET = { ...SET, scorer: 'promo-core-text-v5' };

// An index entry of a promo run: with verdicts unless `errors` is null.
function entry(run, date, evalSet = SET, errors = { count: 1, share: 0.5 }) {
  return { run, flow: FLOW, date, evalSet, totals: { errors } };
}
const route = (a, b) => ({ view: 'compare', flow: FLOW, a, b });

const older = entry('older', '2026-10-31T10:00:00Z');
const newer = entry('newer', '2026-10-31T12:00:00Z');
const otherSet = entry('other-set', '2026-10-31T11:00:00Z', OTHER_SET);
const unscored = entry('unscored', '2026-10-30T18:35:00Z', SET, null);
const unscoredOtherSet = entry('unscored-other-set', '2026-10-30T18:36:00Z', OTHER_SET, null);
const index = { runs: [newer, otherSet, older, unscored, unscoredOtherSet] };

test('routing: two promo runs of one eval set, both with verdicts, are compared, A the older', () => {
  assert.deepEqual(comparedRuns(route('newer', 'older'), index), { a: older, b: newer });
});

test('routing: promo runs of different eval sets are not compared, and the message names both sets', () => {
  assert.deepEqual(comparedRuns(route('older', 'other-set'), index), {
    message:
      'The runs of 31 Oct 2026, 10:00 and 31 Oct 2026, 11:00 are on different eval sets, baseline-10 · promo-core-text-v6 · 2 pages and baseline-10 · promo-core-text-v5 · 2 pages; only two runs of one eval set compare.',
  });
});

test('routing: a promo run without verdicts is not compared, and the message names it', () => {
  assert.deepEqual(comparedRuns(route('older', 'unscored'), index), {
    message:
      'The run of 30 Oct 2026, 18:35 was scored before errors and warnings, so it has no verdicts to compare; only two runs with verdicts compare.',
  });
});

test('routing: two promo runs without verdicts are not compared, and the message names both', () => {
  assert.deepEqual(comparedRuns(route('unscored', 'unscored-other-set'), index), {
    message:
      'The runs of 30 Oct 2026, 18:35 and 30 Oct 2026, 18:36 were scored before errors and warnings, so they have no verdicts to compare; only two runs with verdicts compare.',
  });
});

// The comparison page. Run B, the real run with verdicts; run A, an older run
// of its eval set with another prompt, Biedronka on another model, a failed
// page, and its numbers by hand.
const REAL = '20261031T132616405937-promo';
const realRun = JSON.parse(await readFile(new URL(`./fixtures/${REAL}.json`, import.meta.url), 'utf8'));
const B = { id: REAL, run: realRun };
const A = {
  id: '20261031T100000000000-promo',
  run: {
    ...realRun,
    date: '2026-10-31T10:00:00Z',
    commit: '2104219aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    config: { ...realRun.config, version: 'promo-v3' },
    chain_configs: {
      ...realRun.chain_configs,
      biedronka: { ...realRun.chain_configs.biedronka, model: 'anthropic/claude-haiku-5.5', strategy: 'image', version: 'promo-v3' },
    },
    totals: {
      ...realRun.totals,
      errors: { count: 12, share: 12 / 22 },
      warnings: { count: 10, share: 10 / 22 },
      failed_pages: 1,
      p50_seconds: 3.5,
      cost_usd: 0.0176,
      known_cost_usd: 0.0176,
    },
    by_chain: {
      ...realRun.by_chain,
      aldi: {
        ...realRun.by_chain.aldi,
        errors: { count: 2, share: 2 / 6 },
        warnings: { count: 4, share: 4 / 6 },
        p50_seconds: 3.0,
        cost_usd: 0.004,
        known_cost_usd: 0.004,
      },
    },
  },
};
const compare = (a, b) => viewsOf(FLOW).compare({ flow: FLOW, a, b });

// The text of an element, tags stripped and white space collapsed.
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('the heading shows A and B: date, prompt, models, commit, pages, linking each run page', () => {
  const html = compare(A, B);
  const cards = [...html.matchAll(/<a class="run-card"[^>]*>([\s\S]*?)<\/a>/g)].map(([, card]) => text(card));
  assert.deepEqual(cards, [
    'A 31 Oct 2026, 10:00 older promo-v3 · aldi gemini-2.5-flash · biedronka claude-haiku-5.5 · kaufland gemini-2.5-flash · lidl gemini-2.5-flash commit 2104219 · 8 pages (1 failed)',
    'B 31 Oct 2026, 13:26 newer promo-v4 · gemini-2.5-flash commit 6457199 · 8 pages',
  ]);
  assert.match(html, new RegExp(`<a class="run-card" href="#/promo-extraction/run/${REAL}"`));
  assert.match(html, /title="aldi text · biedronka image · kaufland positioned_text · lidl text"/);
});

test('the heading names the eval set of both runs', () => {
  assert.match(text(compare(A, B)), /Both on the eval set baseline-10-reviewed-v2-context · promo-core-text-v6 · 8 pages/);
});

// The summary's column groups, its body rows (the row's name, then A, B and
// B − A for the total and each chain) and each difference's mark.
const summaryOf = (html) => html.match(/<section[^>]*class="summary"[\s\S]*?<\/section>/)?.[0] ?? '';
const summaryGroups = (html) =>
  [...summaryOf(html).matchAll(/<th scope="colgroup"[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) => text(cell));
const summaryBody = (html) => summaryOf(html).match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
const summaryRows = (html) =>
  [...summaryBody(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) => text(cell)),
  );
const summaryMarks = (html) =>
  [...summaryBody(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<td class="diff (\w+)/g)].map(([, mark]) => mark),
  );

test('the summary by chain shows A, B and B − A for the total and each chain, from each run file as it is', () => {
  const html = compare(A, B);
  assert.match(text(summaryOf(html)), /^Summary by chain/);
  assert.deepEqual(summaryGroups(html), ['Total', 'Aldi', 'Biedronka', 'Kaufland', 'Lidl']);
  assert.deepEqual(summaryRows(html), [
    [
      'Errors',
      '54.5% (12 of 22)', '40.9% (9 of 22)', '▼ −3 promos · −13.6 pts',
      '33.3% (2 of 6)', '66.7% (4 of 6)', '▲ +2 promos · +33.3 pts',
      '83.3% (5 of 6)', '83.3% (5 of 6)', '±0',
      '0.0% (0 of 8)', '0.0% (0 of 8)', '±0',
      '0.0% (0 of 2)', '0.0% (0 of 2)', '±0',
    ],
    [
      'Warnings',
      '45.5% (10 of 22)', '59.1% (13 of 22)', '▲ +3 promos · +13.6 pts',
      '66.7% (4 of 6)', '33.3% (2 of 6)', '▼ −2 promos · −33.3 pts',
      '16.7% (1 of 6)', '16.7% (1 of 6)', '±0',
      '100.0% (8 of 8)', '100.0% (8 of 8)', '±0',
      '100.0% (2 of 2)', '100.0% (2 of 2)', '±0',
    ],
    [
      's / page, median',
      '3.5 s', '2.8 s', '▼ −0.7 s · −19%',
      '3.0 s', '2.8 s', '▼ −0.2 s · −6%',
      '4.5 s', '4.5 s', '±0',
      '1.7 s', '1.7 s', '±0',
      '0.6 s', '0.6 s', '±0',
    ],
    [
      'Cost / page',
      '0.22¢', '0.15¢', '▼ −0.07¢ · −32%',
      '0.20¢', '0.17¢', '▼ −0.03¢ · −16%',
      '0.20¢', '0.20¢', '±0',
      '0.16¢', '0.16¢', '±0',
      '0.07¢', '0.07¢', '±0',
    ],
  ]);
});

test('each difference in the summary is marked better, worse or the same', () => {
  assert.deepEqual(summaryMarks(compare(A, B)), [
    ['better', 'worse', 'same', 'same', 'same'],
    ['worse', 'better', 'same', 'same', 'same'],
    ['better', 'better', 'same', 'same', 'same'],
    ['better', 'better', 'same', 'same', 'same'],
  ]);
});

test('a cost not priced in full shows its priced part, ≥, with no difference', () => {
  const unpriced = { ...A, run: { ...A.run, totals: { ...A.run.totals, cost_usd: null, known_cost_usd: 0.01 } } };
  const [, , , costRow] = summaryRows(compare(unpriced, B));
  assert.deepEqual(costRow.slice(0, 4), ['Cost / page', '≥ 0.13¢', '0.15¢', '']);
});
