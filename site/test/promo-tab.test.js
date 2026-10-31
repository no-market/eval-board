import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise } from '../build/summarise.js';
import { renderPromoTab } from '../src/promo-tab.js';

const fixture = async (id) => summarise(`${id}.json`, JSON.parse(await readFile(new URL(`./fixtures/${id}.json`, import.meta.url), 'utf8')));
// The real run with verdicts, and the real one from before them.
const REAL = '20261031T132616405937-promo';
const entry = await fixture(REAL);
const unscored = await fixture('20261030T183542318891-promo');
const FLOW = 'promo-extraction';

// The text of each header cell, and of each body row's cells, tags stripped
// and white space collapsed.
const text = (cell) => cell.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function headers(html) {
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
  return [...thead.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) => text(cell));
}
function bodyRows(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => text(cell)),
  );
}

test('the columns, in order, with a column of error rate per chain', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry] });
  assert.deepEqual(headers(html), [
    'Compare',
    'Date',
    'Prompt',
    'Model',
    'Pages',
    'Error rate',
    'Aldi',
    'Biedronka',
    'Kaufland',
    'Lidl',
    'Warning rate',
    's / page',
    'Cost / page',
    'Baseline',
  ]);
});

test('the table shows the cells of the real run', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry] });
  assert.deepEqual(bodyRows(html), [
    [
      '',
      '31 Oct 2026, 13:26',
      'promo-v4',
      'gemini-2.5-flash',
      '8',
      '40.9% (9 of 22)',
      '66.7% (4 of 6)',
      '83.3% (5 of 6)',
      '0.0% (0 of 8)',
      '0.0% (0 of 2)',
      '59.1% (13 of 22)',
      '2.8 s',
      '0.15¢',
      'Set as baseline',
    ],
  ]);
});

test('the date links to the run page', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry] });
  assert.match(html, new RegExp(`<a href="#/promo-extraction/run/${REAL}">31 Oct 2026, 13:26</a>`));
});

test('the model shows each chain’s strategy on hover', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry] });
  assert.match(html, /<span title="aldi text · biedronka image · kaufland positioned_text · lidl text">gemini-2.5-flash<\/span>/);
});

test('chains on different models show each chain’s model, without its provider', () => {
  const configs = { ...entry.configs, biedronka: { model: 'anthropic/claude-haiku-5.5', strategy: 'image' } };
  const [row] = bodyRows(renderPromoTab({ flow: FLOW, runs: [{ ...entry, configs }] }));
  assert.equal(row[3], 'aldi gemini-2.5-flash · biedronka claude-haiku-5.5 · kaufland gemini-2.5-flash · lidl gemini-2.5-flash');
});

test('a chain not in a run shows a dash in its column', () => {
  const { lidl, ...byChain } = entry.byChain;
  const older = { ...entry, run: 'older', date: '2026-10-31T12:00:00Z', byChain };
  const rows = bodyRows(renderPromoTab({ flow: FLOW, runs: [entry, older] }));
  assert.equal(rows[1][9], '—');
});

test('cost per page is the priced part marked ≥ when the run’s cost is not known', () => {
  const totals = { ...entry.totals, pages: 10, costUsd: null, knownCostUsd: 0.00757216 };
  const html = renderPromoTab({ flow: FLOW, runs: [{ ...entry, totals }] });
  assert.equal(bodyRows(html)[0][12], '≥ 0.08¢');
  assert.match(html, /title="Some calls were not priced: this is the priced part"/);
});

test('the heading names the current eval set', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry] });
  assert.match(html, /<h1 style="color: #9A4A12">Promos<\/h1>/);
  assert.match(html, /1 eval run on the eval set <strong[^>]*>baseline-10-reviewed-v2-context · promo-core-text-v6 · 8 pages<\/strong>/);
  assert.match(html, /<nav aria-label="Flows">[\s\S]*<a href="#\/promo-extraction" aria-current="page"[\s\S]*Promos<\/a>[\s\S]*<\/nav>/);
});

test('the table holds only the runs of the current eval set, newest first', () => {
  const sameSet = { ...entry, run: 'same-set', date: '2026-10-31T13:25:00Z' };
  const otherScorer = { ...entry, run: 'other-scorer', date: '2026-10-31T12:38:00Z', evalSet: { ...entry.evalSet, scorer: 'promo-core-text-v5' } };
  const otherPages = { ...entry, run: 'other-pages', date: '2026-10-31T12:30:00Z', evalSet: { ...entry.evalSet, selection: entry.evalSet.selection.slice(1) } };
  const newerUnscored = { ...unscored, date: '2026-11-01T09:00:00Z' };
  const html = renderPromoTab({ flow: FLOW, runs: [newerUnscored, entry, sameSet, otherScorer, otherPages] });
  assert.deepEqual(bodyRows(html).map((cells) => cells[1]), ['31 Oct 2026, 13:26', '31 Oct 2026, 13:25']);
  assert.match(html, /2 eval runs on the eval set/);
});

test('with no run with verdicts, the tab says there are none yet', () => {
  for (const runs of [[], [unscored]]) {
    const html = renderPromoTab({ flow: FLOW, runs });
    assert.match(html, /No promo eval runs with verdicts yet/);
    assert.doesNotMatch(html, /<table/);
  }
});

test('text from a run file is escaped', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [{ ...entry, prompt: '<b>v4</b>' }] });
  assert.match(html, /&lt;b&gt;v4&lt;\/b&gt;/);
});

// An older run of the same eval set, as the baseline: 10 errors and 12
// warnings of 22 promos, 3 errors of Aldi's 6, 2.9 s and 0.23¢ per page.
const older = {
  ...entry,
  run: 'older',
  date: '2026-10-31T12:38:02Z',
  totals: {
    ...entry.totals,
    errors: { count: 10, share: 10 / 22 },
    warnings: { count: 12, share: 12 / 22 },
    seconds: { median: 2.9445, p95: 4 },
    costUsd: 0.01819464,
  },
  byChain: { ...entry.byChain, aldi: { ...entry.byChain.aldi, errors: { count: 3, share: 0.5 } } },
};

// The differences under the numbers of each body row, as [mark, text].
function differences(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<div class="diff (\w+)">([^<]*)<\/div>/g)].map(([, mark, text]) => [mark, text]),
  );
}

test('with no baseline, no differences show and a hint says how to set one', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older] });
  assert.deepEqual(differences(html), [[], []]);
  assert.match(html, /Set a baseline/);
  assert.match(html, /<a class="base-button" href="#\/promo-extraction\?base=older"[^>]*>Set as baseline<\/a>/);
});

test('under each number of a non-baseline row, its difference from the baseline in promos, points, seconds and cents', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older], base: 'older' });
  assert.deepEqual(differences(html), [
    [
      ['better', '▼ −1 promo · −4.5 pts'],
      ['worse', '▲ +1 promo · +16.7 pts'],
      ['same', '±0'],
      ['same', '±0'],
      ['same', '±0'],
      ['worse', '▲ +1 promo · +4.5 pts'],
      ['better', '▼ −0.1 s · −4%'],
      ['better', '▼ −0.08¢ · −34%'],
    ],
    [],
  ]);
  assert.match(html, /Differences against the baseline, 31 Oct 2026, 12:38/);
  assert.match(html, /<tr class="base">/);
  assert.match(html, /<a class="base-button" href="#\/promo-extraction" aria-pressed="true"[^>]*>Baseline ✕<\/a>/);
});

test('a cost known only in part carries no difference', () => {
  const partial = { ...entry, totals: { ...entry.totals, costUsd: null } };
  const [row] = differences(renderPromoTab({ flow: FLOW, runs: [partial, older], base: 'older' }));
  assert.equal(row.length, 7);
  assert.ok(row.every(([, text]) => !text.includes('¢')));
});

test('a baseline on another eval set is not used', () => {
  const other = { ...older, evalSet: { ...entry.evalSet, scorer: 'promo-core-text-v5' } };
  const html = renderPromoTab({ flow: FLOW, runs: [entry, other], base: 'older' });
  assert.deepEqual(differences(html), [[]]);
});

// Each row's box, as [run, ticked].
function boxes(html) {
  return [...html.matchAll(/<input type="checkbox" data-tick="([^"]+)"([^>]*)>/g)].map(([, run, rest]) => [run, / checked/.test(rest)]);
}

test('each row has a box for comparing, ticked for the ticked runs', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older], ticked: ['older'] });
  assert.deepEqual(boxes(html), [[REAL, false], ['older', true]]);
  assert.match(html, /1 of 2 runs ticked/);
  assert.match(html, /<button type="button" class="compare-button" disabled>Tick 2 runs to compare<\/button>/);
});

test('with two runs ticked, a button opens their comparison, A the older', () => {
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older], ticked: [REAL, 'older'] });
  assert.match(html, /2 runs ticked/);
  assert.match(html, new RegExp(`<a class="compare-button" href="#/promo-extraction/compare/older/${REAL}">Compare 2 runs</a>`));
});

test('a ticked run of another eval set does not count towards the pair', () => {
  const other = { ...older, run: 'other', evalSet: { ...entry.evalSet, scorer: 'promo-core-text-v5' } };
  const html = renderPromoTab({ flow: FLOW, runs: [entry, older, other], ticked: [REAL, 'other'] });
  assert.match(html, /1 of 2 runs ticked/);
});
