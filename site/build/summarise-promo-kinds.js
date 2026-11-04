// A promo kinds run as one entry of the index: the run as the promo kinds
// views read it (see promoKindsRun), with its id, file and flow.
import { promoKindsRun } from '../src/promo-kinds-runs.js';

export function summarisePromoKindsRun(file, run) {
  return { run: file.replace(/\.json$/, ''), file, flow: run.flow, ...promoKindsRun(run) };
}
