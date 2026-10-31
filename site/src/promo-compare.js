// The comparison of two promo runs of one eval set, both with verdicts, at
// #/promo-extraction/compare/<a>/<b> (comparedRuns refuses any other pair):
// a heading with two run cards, then its sections in order. A section is a
// function of the comparison (see `comparison`) to HTML; a later section is
// added to SECTIONS, reading what it needs from the comparison.
import { wrappable } from './compare.js';
import { centsDifference, promosDifference, secondsDifference } from './differences.js';
import { evalSetName } from './eval-sets.js';
import { flowById } from './flows.js';
import { formatDate, formatSeconds } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { chainName, costPerPage, modelsLine, strategiesLine } from './promo-runs.js';
import { cost, shareOf } from './promo-tab.js';
import { runAddress } from './route.js';

// What every section reads: the flow, runs A and B, each { id, run } with
// `run` the run file as it is, and the chains of either, in alphabetical order.
function comparison({ flow, a, b }) {
  const chains = [...new Set([a, b].flatMap(({ run }) => Object.keys(run.by_chain)))].sort();
  return { flow: flowById(flow), a, b, chains };
}

// The summary by chain, from each run file as it is: a row per number, A, B
// and B − A for the total and each chain. A chain one run lacks is `—`.
function summary({ a, b, chains }) {
  const columns = [
    { name: 'Total', of: (runFile) => numbers(runFile.totals, runFile.cases.length) },
    ...chains.map((chain) => ({
      name: chainName(chain),
      of: (runFile) =>
        runFile.by_chain[chain] ? numbers(runFile.by_chain[chain], runFile.cases.filter((c) => c.chain === chain).length) : null,
    })),
  ];
  const total = (i) => (i === 0 ? ' total' : '');
  return html`<section aria-labelledby="summary-h" class="summary">
    <div class="section-head">
      <h2 id="summary-h">Summary by chain</h2>
      <span class="muted small"><span class="better">▼ better</span> · <span class="worse">▲ worse</span> · lower is better everywhere</span>
    </div>
    <div class="table-wrap">
      <table class="by-step">
        <thead>
          <tr>
            <th scope="col" rowspan="2"></th>
            ${columns.map((column, i) => html`<th scope="colgroup" colspan="3" class="group${total(i)}">${column.name}</th>`)}
          </tr>
          <tr>${columns.map((_, i) => html`<th scope="col" class="num${total(i)}">A</th><th scope="col" class="num${total(i)}">B</th><th scope="col" class="num${total(i)}">B − A</th>`)}</tr>
        </thead>
        <tbody>${SUMMARY_ROWS.map((row) => html`
          <tr>
            <th scope="row">${row.name}</th>${columns.map((column, i) => cells(row, column.of(a.run), column.of(b.run), total(i)))}
          </tr>`)}
        </tbody>
      </table>
    </div>
    <p class="muted small">Each difference reads B against A: promos and percentage points for errors and warnings, counted in promos; seconds and the change in per cent (×N when B takes at least twice as long) for the median seconds per page; cents (¢) per page for cost, ≥ the priced part, with no difference, when some calls weren’t priced. Each run’s own numbers, over all its pages.</p>
  </section>`;
}

// The numbers of a run file's totals, or of one chain's, over its `pages`.
function numbers(totals, pages) {
  return {
    promos: totals.promos,
    errors: totals.errors,
    warnings: totals.warnings,
    seconds: totals.p50_seconds,
    cost: costPerPage({ costUsd: totals.cost_usd, knownCostUsd: totals.known_cost_usd, pages }),
  };
}

// The summary's rows: how a total's or a chain's numbers are written, and the
// difference of two, or null for none.
const SUMMARY_ROWS = [
  { name: 'Errors', format: (n) => shareOf(n), difference: (a, b) => promosDifference(a.errors, b.errors) },
  { name: 'Warnings', format: (n) => shareOf(n, 'warnings'), difference: (a, b) => promosDifference(a.warnings, b.warnings) },
  { name: 's / page, median', format: (n) => formatSeconds(n.seconds), difference: (a, b) => secondsDifference(a.seconds, b.seconds) },
  {
    name: 'Cost / page',
    format: (n) => cost(n.cost),
    difference: (a, b) => (a.cost?.priced && b.cost?.priced ? centsDifference(a.cost.usd, b.cost.usd) : null),
  },
];

function cells(row, a, b, total) {
  const found = a && b ? row.difference(a, b) : null;
  const written = (n) => (n ? row.format(n) : dash);
  return html`<td class="num nowrap${total}">${written(a)}</td><td class="num nowrap${total}">${written(b)}</td><td class="diff ${found ? found.mark : 'same'} num${total}">${found ? wrappable(found.text) : ''}</td>`;
}

const dash = html`<span class="muted">—</span>`;

// The sections of the comparison, in order, after its heading. The promos
// whose verdict changed (#24) follow the summary.
const SECTIONS = [summary];

// The page of the comparison of promo runs `a` and `b`, each { id, run }, A the older.
export function renderPromoCompare({ flow, a, b }) {
  const c = comparison({ flow, a, b });
  return String(html`${header(c.flow.id)}
<main class="compare" style="--flow: ${c.flow.colour}">
  ${heading(c)}
  ${SECTIONS.map((section) => section(c))}
</main>`);
}

// The heading: the eval set both runs are on, and a card for each.
function heading({ flow, a, b }) {
  return html`<div class="compare-heading">
    <a class="back" href="#/${flow.id}">← All promo runs</a>
    <h1>Comparing two eval runs</h1>
    <p class="muted">Both on the eval set <strong>${evalSetName(evalSetOf(a.run))}</strong></p>
    <div class="run-cards">
      ${runCard(flow, 'A', 'older', a)}
      ${runCard(flow, 'B', 'newer', b)}
    </div>
  </div>`;
}

function runCard(flow, letter, age, { id, run: runFile }) {
  const configs = configsOf(runFile);
  const failed = runFile.totals.failed_pages;
  return html`<a class="run-card" href="${runAddress(flow.id, id)}">
        <span class="run-card-title"><span class="letter letter-${letter.toLowerCase()}">${letter}</span><strong>${formatDate(runFile.date)}</strong><span class="muted small">${age}</span></span>
        <span>${runFile.config.version} · <span title="${strategiesLine(configs)}">${modelsLine(configs)}</span></span>
        <span class="muted small">commit <code>${runFile.commit.slice(0, 7)}</code> · ${pagesCount(runFile.cases.length)}${failed > 0 ? ` (${failed} failed)` : ''}</span>
      </a>`;
}

// Each chain's config, by chain in alphabetical order, as the index has them
// (see build/summarise-promo.js): the chain's own, else the run's.
function configsOf(runFile) {
  return Object.fromEntries(
    Object.keys(runFile.by_chain)
      .sort()
      .map((chain) => [chain, runFile.chain_configs?.[chain] ?? runFile.config]),
  );
}

// A run file's eval set, as the index has it (see eval-sets.js).
function evalSetOf(runFile) {
  return {
    dataset: runFile.dataset_revision,
    scorer: runFile.scorer_version,
    selection: [...new Set(runFile.selection)].sort(),
  };
}

// `8 pages`, `1 page`.
function pagesCount(n) {
  return n === 1 ? '1 page' : `${n} pages`;
}
