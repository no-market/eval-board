// A promo run (schema_version 3 or 4) as one entry of the index: the run as
// the promo views read it (see promoRun), with its id, file and flow.
import { promoRun } from '../src/promo-runs.js';

export function summarisePromoRun(file, run) {
  return { run: file.replace(/\.json$/, ''), file, flow: run.flow, ...promoRun(run) };
}
