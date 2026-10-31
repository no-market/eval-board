// Eval sets of promo runs. A run's eval set is its dataset revision, scorer
// version and selection of pages taken as a set (the index keeps the
// selection sorted, see build/summarise-promo.js); runs compare only within
// one eval set. The current eval set is that of the newest run with verdicts.

// Whether two eval sets are one: the same dataset revision, scorer version
// and pages.
export function sameEvalSet(a, b) {
  return (
    a.dataset === b.dataset &&
    a.scorer === b.scorer &&
    a.selection.length === b.selection.length &&
    a.selection.every((page, i) => page === b.selection[i])
  );
}

// Whether a promo run (an index entry) was scored with verdicts, so has
// errors and warnings; a run scored before them (schema_version 3) has not.
export function hasVerdicts(run) {
  return run.totals.errors !== null && run.totals.errors !== undefined;
}

// The eval set of the newest run with verdicts among `runs`, or null when
// none has verdicts.
export function currentEvalSet(runs) {
  const newest = runs
    .filter(hasVerdicts)
    .reduce((found, run) => (found && Date.parse(found.date) >= Date.parse(run.date) ? found : run), null);
  return newest ? newest.evalSet : null;
}

// The runs of `evalSet` among `runs`, in their order.
export function inEvalSet(runs, evalSet) {
  return runs.filter((run) => sameEvalSet(run.evalSet, evalSet));
}

// The history: the runs among `runs` not of `evalSet` (all of them when
// there is no current eval set), newest first by date.
export function history(runs, evalSet) {
  return runs
    .filter((run) => !evalSet || !sameEvalSet(run.evalSet, evalSet))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

// `baseline-10-reviewed-v2-context · promo-core-text-v6 · 8 pages`
export function evalSetName({ dataset, scorer, selection }) {
  const pages = selection.length === 1 ? '1 page' : `${selection.length} pages`;
  return `${dataset} · ${scorer} · ${pages}`;
}
