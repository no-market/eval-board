// What the site knows of a promo kinds run, shared by its views and the
// build. `promoKindsRun` reads a run file into one shape, which is also the
// run's index entry (see build/summarise-promo-kinds.js): its model, its eval
// set, and its numbers in total and by group, each over its own promos. The
// run file is the one stated in the spec, as the board can't read the backend.
import { formatCents, formatShare } from './format.js';
import { dash, html } from './html.js';
import { identity } from './promo-changes.js';
import { chainName, costChange, costPer, costWritten } from './promo-runs.js';

// A run file as the views read it: { date, commit, evalSet, prompt, model,
// full, totals, byGroup }. Its selection is of promos.
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
    full: runFile.full,
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

// `1 of 2`: the errors (or warnings) of numbers, its share on hover; for a
// table of many numbers, where a group is one size in both runs.
export function countOf(numbers, of = 'errors') {
  const found = numbers[of];
  return html`<span title="${formatShare(found.share)}">${found.count} of ${numbers.promos}</span>`;
}

// The groups of any of `runs`, each once, in alphabetical order.
export function groupsInRuns(runs) {
  return [...new Set(runs.flatMap((run) => Object.keys(run.byGroup)))].sort();
}

// A promo costs thousandths of a cent, so cost has a place more than the
// other flows': at two, $0.00004 reads as nothing.
const CENT_PLACES = 3;

// `0.015¢`: a cost per promo in US dollars.
export function promoCents(usd) {
  return formatCents(usd, CENT_PLACES);
}

// Cost per promo, from numbers in total or of a group.
export function costPerPromo(numbers) {
  return costPer(numbers, numbers.promos);
}

// `0.015¢`, or `≥ 0.008¢` for the priced part, of numbers in total or of a group.
export function costCell(numbers) {
  return costWritten(costPerPromo(numbers), CENT_PLACES);
}

// The difference in cost per promo from numbers `a` to `b`, or null.
export function costDifference(a, b) {
  return costChange(costPerPromo(a), costPerPromo(b), CENT_PLACES);
}

// What the eval set's error rate says, and what it doesn't.
export const hardCases = html`<p class="muted small">This eval set is made of hard cases, a group for each trap, so its error rate compares configurations only; it isn’t how the live stream fares.</p>`;

// More kinds than this fold, as a range can list 30.
const FOLDED_FROM = 9;

// `Muted label `, or nothing without one.
const labelled = (label) => (label ? html`<span class="muted">${label}</span> ` : '');

// `certain Pieprz`: named kinds under a muted label, or nothing without kinds.
function kindsLine(label, kinds) {
  return kinds.length ? html`<div>${labelled(label)}${kinds.join(', ')}</div>` : '';
}

// The same, as `may cover 30 kinds`, opening to them, for a long list.
function foldedKinds(label, kinds) {
  if (kinds.length < FOLDED_FROM) return kindsLine(label, kinds);
  return html`<details class="kinds"><summary>${labelled(label)}${kinds.length} kinds</summary>${kinds.join(', ')}</details>`;
}

// What the truth expects of a promo, from a case's `expected`: out of scope,
// or its certain kinds and the others it may cover, under `Unclear` when the
// wording doesn't show what is covered. `certain` is inside `possible`.
export function expectedKinds({ outcome, certain, possible }) {
  if (outcome === 'out_of_scope') return html`<div>Out of scope</div>`;
  const others = possible.filter((kind) => !certain.includes(kind));
  return html`${outcome === 'unclear' ? html`<div>Unclear</div>` : ''}${foldedKinds('certain', certain)}${foldedKinds('may cover', others)}`;
}

// What a case's answer was: its stored and new kinds, out of scope, "I don't
// know", or why there is none.
export function answeredKinds({ answer, failed, failure }) {
  if (failed) return html`<div><strong>Failed:</strong> ${failure}</div>`;
  if (answer.outcome === 'out_of_scope') return html`<div>Out of scope</div>`;
  if (answer.outcome === 'unknown') return html`<div>I don’t know</div>`;
  if (!answer.kinds.length && !answer.new_kinds.length) return dash;
  return html`${foldedKinds(null, answer.kinds)}${foldedKinds('new', answer.new_kinds)}`;
}

// The kinds a case in error missed and those extra, each only under its
// reason: without one, the names differing may be an accepted alternative,
// which the run file doesn't hold. Names compare as the scorer's do, ignoring
// case and diacritics.
export function kindsDifference({ errors, expected, answer }) {
  const answered = [...answer.kinds, ...answer.new_kinds];
  const given = new Set(answered.map(identity));
  const covered = new Set(expected.possible.map(identity));
  const missed = errors.includes('missed_kind') ? expected.certain.filter((kind) => !given.has(identity(kind))) : [];
  const extra = errors.includes('extra_kind') ? answered.filter((kind) => !covered.has(identity(kind))) : [];
  return html`${kindsLine('missed', missed)}${kindsLine('extra', extra)}`;
}

// What the board can't tell of a difference.
export const differenceNote = html`<p class="muted small">Missed and extra kinds are worked out here from the names in the run file, which doesn’t hold the truth’s accepted alternatives, so an accepted alternative may show among them.</p>`;

// The promo of a case: its wording, then its group and chain.
export function promoCell(promo) {
  return html`<div title="${promo.id}">${promo.name}</div><div class="muted small nowrap">${promo.group} · ${chainName(promo.chain)}</div>`;
}
