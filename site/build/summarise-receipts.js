// A receipt lines run (schema_version 3) as one entry of the index: what the
// table and the chart need, without loading the run file.
export function summariseReceiptRun(file, run) {
  const { numbers } = run;
  return {
    run: file.replace(/\.json$/, ''),
    file,
    flow: run.flow,
    date: run.date,
    commit: run.commit,
    flowVersion: run.flow_version,
    models: { read: run.steps.read.model, chooseKinds: run.steps.choose_kinds.model },
    receipts: numbers.receipts,
    failed: numbers.failed,
    lines: numbers.lines,
    errors: numbers.errors,
    warnings: numbers.warnings,
    seconds: { median: numbers.seconds.median_s, p95: numbers.seconds.p95_s },
    costUsd: numbers.cost_usd,
  };
}
