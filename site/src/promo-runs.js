// What the site knows of a promo run, shared by the promo views and the
// build. `promoRun` reads a run file into one shape, which is also the run's
// index entry (see build/summarise-promo.js): its chains' configs, its eval
// set, and its numbers in total and by chain, each over its own pages. The
// helpers below work on that shape.
import { centsDifference } from './differences.js';
import { formatCents, formatShare, shortModel } from './format.js';
import { dash, html, orDash } from './html.js';

// A run file as the views read it: { date, commit, schemaVersion, evalSet,
// prompt, configs, totals, byChain }. A run scored before verdicts
// (schema_version 3) has no promos, errors or warnings: those are null.
export function promoRun(runFile) {
  const chains = Object.keys(runFile.by_chain).sort();
  const pagesOf = (chain) => runFile.cases.filter((c) => c.chain === chain).length;
  const configOf = (chain) => runFile.chain_configs?.[chain] ?? runFile.config;
  return {
    date: runFile.date,
    commit: runFile.commit,
    schemaVersion: runFile.schema_version,
    // The run's eval set: its selection taken as a set, so sorted.
    evalSet: {
      dataset: runFile.dataset_revision,
      scorer: runFile.scorer_version,
      selection: [...new Set(runFile.selection)].sort(),
    },
    prompt: runFile.config.version,
    configs: Object.fromEntries(
      chains.map((chain) => {
        const { model, strategy } = configOf(chain);
        return [chain, { model, strategy }];
      }),
    ),
    totals: numbers(runFile.totals, runFile.cases.length),
    byChain: Object.fromEntries(chains.map((chain) => [chain, numbers(runFile.by_chain[chain], pagesOf(chain))])),
  };
}

// The numbers of a run, or of one chain in it, over its `pages`. Costs are
// the run's (or chain's) whole cost in US dollars: `costUsd` null when some
// calls weren't priced, `knownCostUsd` the priced part.
function numbers(totals, pages) {
  return {
    pages,
    truth: totals.truth,
    promos: totals.promos ?? null,
    errors: totals.errors ?? null,
    warnings: totals.warnings ?? null,
    matched: totals.matched,
    missed: totals.missed,
    extra: totals.extra,
    recall: totals.recall,
    precision: totals.precision,
    failedPages: totals.failed_pages,
    seconds: { median: totals.p50_seconds, p95: totals.p95_seconds },
    costUsd: totals.cost_usd,
    knownCostUsd: totals.known_cost_usd,
  };
}

// `Aldi` for `aldi`.
export function chainName(chain) {
  return chain[0].toUpperCase() + chain.slice(1);
}

// `Aldi p. 4`: a chain's leaflet page.
export function pageLabel(chain, page) {
  return `${chainName(chain)} p. ${page}`;
}

// The chains of any of `runs`, each once, in alphabetical order.
export function chainsInRuns(runs) {
  return [...new Set(runs.flatMap((run) => Object.keys(run.byChain)))].sort();
}

// `gemini-2.5-flash` when every chain has that model, else each chain's:
// `aldi gemini-2.5-flash · biedronka claude-haiku-5.5`; without providers.
export function modelsLine(configs) {
  const models = Object.entries(configs).map(([chain, { model }]) => [chain, shortModel(model)]);
  if (new Set(models.map(([, model]) => model)).size === 1) return models[0][1];
  return models.map(([chain, model]) => `${chain} ${model}`).join(' · ');
}

// `aldi text · biedronka image`: each chain's strategy.
export function strategiesLine(configs) {
  return Object.entries(configs).map(([chain, { strategy }]) => `${chain} ${strategy}`).join(' · ');
}

// `45.5% (10 of 22)`: the errors (or warnings) of `numbers`, counted in
// promos; `—` for a run scored before verdicts.
export function shareOf(numbers, of = 'errors') {
  const found = numbers[of];
  if (!found) return dash;
  return html`${formatShare(found.share)} <span class="muted">(${found.count} of ${numbers.promos})</span>`;
}

// Cost per page in US dollars, from numbers in total or of a chain:
// { usd, priced }, `priced` false when some calls weren't priced and `usd`
// is the priced part only; null without pages.
export function costPerPage({ costUsd, knownCostUsd, pages }) {
  if (!pages) return null;
  if (costUsd !== null && costUsd !== undefined) return { usd: costUsd / pages, priced: true };
  return { usd: knownCostUsd / pages, priced: false };
}

// `0.15¢`, or `≥ 0.08¢` for the priced part, of numbers in total or of a chain.
export function costCell(numbers) {
  const perPage = costPerPage(numbers);
  if (!perPage) return dash;
  if (perPage.priced) return formatCents(perPage.usd);
  return html`<span title="Some calls were not priced: this is the priced part">≥ ${formatCents(perPage.usd)}</span>`;
}

// The difference in cost per page from numbers `a` to `b` (see
// differences.js), only when both costs are known in full; else null.
export function costDifference(a, b) {
  const [costA, costB] = [costPerPage(a), costPerPage(b)];
  if (!costA?.priced || !costB?.priced) return null;
  return centsDifference(costA.usd, costB.usd);
}

// The numbers of a run scored before verdicts, as [heading, cell of numbers]:
// promos matched to the truth, missed and made up, recall and precision.
export const MATCHING_COLUMNS = [
  ['Matched', (n) => html`${n.matched} <span class="muted">of ${n.truth}</span>`],
  ['Missed', (n) => n.missed],
  ['Made up', (n) => n.extra],
  ['Recall', (n) => orDash(n.recall, formatShare)],
  ['Precision', (n) => orDash(n.precision, formatShare)],
];
