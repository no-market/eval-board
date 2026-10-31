// A promo run (schema_version 3 or 4) as one entry of the index. A promo
// run's case is a leaflet page; its numbers are in total and by chain. A run
// scored before verdicts (schema_version 3) has no promos, errors or warnings:
// those are null.
export function summarisePromoRun(file, run) {
  const chains = Object.keys(run.by_chain).sort();
  const pagesOf = (chain) => run.cases.filter((c) => c.chain === chain).length;
  const configOf = (chain) => run.chain_configs?.[chain] ?? run.config;
  return {
    run: file.replace(/\.json$/, ''),
    file,
    flow: run.flow,
    date: run.date,
    commit: run.commit,
    schemaVersion: run.schema_version,
    // The run's eval set: its selection taken as a set, so sorted.
    evalSet: {
      dataset: run.dataset_revision,
      scorer: run.scorer_version,
      selection: [...new Set(run.selection)].sort(),
    },
    prompt: run.config.version,
    configs: Object.fromEntries(
      chains.map((chain) => {
        const { model, strategy } = configOf(chain);
        return [chain, { model, strategy }];
      }),
    ),
    totals: numbers(run.totals, run.cases.length),
    byChain: Object.fromEntries(chains.map((chain) => [chain, numbers(run.by_chain[chain], pagesOf(chain))])),
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
