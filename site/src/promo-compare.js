// The comparison of two promo runs of one eval set, both with verdicts, at
// #/promo-extraction/compare/<a>/<b> (comparedRuns refuses any other pair):
// a heading with two run cards, then its sections in order. A section is a
// function of the comparison (see `comparison`) to HTML; a later section is
// added to SECTIONS, reading what it needs from the comparison.
import { evalSetName } from './eval-sets.js';
import { flowById } from './flows.js';
import { formatDate } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { modelsLine, strategiesLine } from './promo-runs.js';
import { runAddress } from './route.js';

// What every section reads: the flow, runs A and B, each { id, run } with
// `run` the run file as it is, and the chains of either, in alphabetical order.
function comparison({ flow, a, b }) {
  const chains = [...new Set([a, b].flatMap(({ run }) => Object.keys(run.by_chain)))].sort();
  return { flow: flowById(flow), a, b, chains };
}

// The sections of the comparison, in order, after its heading.
const SECTIONS = [];

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
