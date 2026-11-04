// What the site knows of a promo kinds run, shared by its views and the
// build. `promoKindsRun` reads a run file into one shape, which is also the
// run's index entry (see build/summarise-promo-kinds.js): its model, its eval
// set, and its numbers in total and by group, each over its own promos. The
// run file is the one stated in the spec, as the board can't read the backend.
import { html } from './html.js';
import { costChange, costPer, costWritten } from './promo-runs.js';

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
