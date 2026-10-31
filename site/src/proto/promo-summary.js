// PROTOTYPE, throwaway: a promo eval run as one entry of the index.
// A promo run's numbers are per page (a leaflet page is its case), cost is the
// mean per page, seconds the median per page. Runs scored before verdicts
// (schema_version 3) have no promos, errors or warnings.

export const CHAINS = ['aldi', 'biedronka', 'kaufland', 'lidl', 'netto'];

export function summarisePromo(file, run) {
  const pages = run.cases.length;
  const chains = Object.keys(run.by_chain).sort();
  const configOf = (chain) => run.chain_configs?.[chain] ?? run.config;
  const pagesOf = (chain) => run.cases.filter((c) => c.chain === chain).length;
  const perPage = (usd, n) => (usd === null || usd === undefined || !n ? null : usd / n);
  const numbers = (t, n) => ({
    truth: t.truth,
    promos: t.promos ?? null,
    errors: t.errors ?? null,
    warnings: t.warnings ?? null,
    matched: t.matched,
    missed: t.missed,
    extra: t.extra,
    recall: t.recall,
    precision: t.precision,
    failedPages: t.failed_pages,
    pages: n,
    seconds: { median: t.p50_seconds, p95: t.p95_seconds },
    costUsd: perPage(t.cost_usd, n),
    knownCostUsd: perPage(t.known_cost_usd, n),
  });
  const selection = [...run.selection].sort();
  return {
    run: file.replace(/\.json$/, ''),
    file,
    flow: run.flow,
    date: run.date,
    commit: run.commit,
    schemaVersion: run.schema_version,
    dataset: run.dataset_revision,
    scorer: run.scorer_version,
    prompt: run.config.version,
    configs: Object.fromEntries(chains.map((chain) => [chain, configOf(chain)])),
    rescoredFrom: run.prototype_rescored_from ?? null,
    full: run.full,
    // The eval set: runs compare only on the same dataset revision, scorer and pages.
    evalSet: {
      key: `${run.dataset_revision}|${run.scorer_version}|${selection.join(',')}`,
      label: `${run.dataset_revision} · ${run.scorer_version} · ${pages} pages`,
      dataset: run.dataset_revision,
      scorer: run.scorer_version,
      pages,
    },
    ...numbers(run.totals, pages),
    byChain: Object.fromEntries(chains.map((chain) => [chain, numbers(run.by_chain[chain], pagesOf(chain))])),
  };
}
