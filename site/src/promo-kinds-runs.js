// What the site knows of a promo kinds run, shared by its views and the
// build. `promoKindsRun` reads a run file into one shape, which is also the
// run's index entry (see build/summarise-promo-kinds.js): its model, its eval
// set, and its numbers in total and by group, each over its own promos. The
// run file is the one stated in the spec, as the board can't read the backend.
import { dash, html } from './html.js';
import { chainName, costChange, costPer, costWritten } from './promo-runs.js';

// A run file as the views read it: { date, commit, evalSet, prompt, model,
// totals, byGroup }. Its selection is of promos.
export function promoKindsRun(runFile) {
  return {
    date: runFile.date,
    commit: runFile.commit,
    evalSet: {
      dataset: runFile.dataset_revision,
      scorer: runFile.scorer_version,
      selection: [...new Set(runFile.selection)].sort(),
      unit: 'promo',
    },
    prompt: runFile.prompt_version,
    model: runFile.model,
    totals: numbers(runFile.totals),
    byGroup: Object.fromEntries(Object.entries(runFile.by_group).map(([group, totals]) => [group, numbers(totals)])),
  };
}

// The numbers of a run, or of one group in it. Costs are its whole cost in US
// dollars: `costUsd` null when some calls weren't priced, `knownCostUsd` the
// priced part.
function numbers(totals) {
  return {
    promos: totals.promos,
    errors: totals.errors,
    warnings: totals.warnings,
    failed: totals.failed,
    seconds: { median: totals.p50_seconds, p95: totals.p95_seconds },
    costUsd: totals.cost_usd,
    knownCostUsd: totals.known_cost_usd,
  };
}

// Cost per promo, from numbers in total or of a group.
export function costPerPromo(numbers) {
  return costPer(numbers, numbers.promos);
}

export function costCell(numbers) {
  return costWritten(costPerPromo(numbers));
}

export function costDifference(a, b) {
  return costChange(costPerPromo(a), costPerPromo(b));
}

// What the eval set's error rate says, and what it doesn't.
export const hardCases = html`<p class="muted small">This eval set is made of hard cases, a group for each trap, so its error rate compares configurations only; it isn’t how the live stream fares.</p>`;

// `certain Pieprz`: named kinds under a muted label, or nothing without kinds.
function kindsLine(label, kinds) {
  if (!kinds.length) return '';
  return html`<div>${label ? html`<span class="muted">${label}</span> ` : ''}${kinds.join(', ')}</div>`;
}

// What the truth expects of a promo, from a case's `expected`: out of scope,
// or its certain kinds and the others it may cover, under `Unclear` when the
// wording doesn't show what is covered. `certain` is inside `possible`.
export function expectedKinds({ outcome, certain, possible }) {
  if (outcome === 'out_of_scope') return html`<div>Out of scope</div>`;
  const others = possible.filter((kind) => !certain.includes(kind));
  return html`${outcome === 'unclear' ? html`<div>Unclear</div>` : ''}${kindsLine('certain', certain)}${kindsLine('may cover', others)}`;
}

// What a case's answer was: its stored and new kinds, out of scope, "I don't
// know", or why there is none.
export function answeredKinds({ answer, failed, failure }) {
  if (failed) return html`<div><strong>Failed:</strong> ${failure}</div>`;
  if (!answer) return dash;
  if (answer.outcome === 'out_of_scope') return html`<div>Out of scope</div>`;
  if (answer.outcome === 'unknown') return html`<div>I don’t know</div>`;
  if (!answer.kinds.length && !answer.new_kinds.length) return dash;
  return html`${kindsLine(null, answer.kinds)}${kindsLine('new', answer.new_kinds)}`;
}

// The promo of a case: its wording, then its group and chain.
export function promoCell(promo) {
  return html`<div title="${promo.id}">${promo.name}</div><div class="muted small nowrap">${promo.group} · ${chainName(promo.chain)}</div>`;
}
