import { summarisePromoRun } from './summarise-promo.js';
import { summariseReceiptRun } from './summarise-receipts.js';

// Each flow's summariser: a run as one entry of the index, what its views
// need without loading the run file. Every flow in FLOWS (src/flows.js) has one.
const SUMMARISERS = {
  'receipt-lines': summariseReceiptRun,
  'promo-extraction': summarisePromoRun,
};

export function summarise(file, run) {
  return SUMMARISERS[run.flow](file, run);
}
