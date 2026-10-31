// Each flow's views: its tab, its run page and its comparison, chosen by the
// flow so that each view knows only its own flow's runs. main.js opens the
// view an address names through viewsOf; every flow in FLOWS has all three.
import { renderCompare } from './compare.js';
import { renderPromoCompare } from './promo-compare.js';
import { renderPromoRun } from './promo-run.js';
import { renderPromoTab } from './promo-tab.js';
import { renderRun } from './run.js';
import { renderTab } from './tab.js';

const VIEWS = {
  'receipt-lines': { tab: renderTab, run: renderRun, compare: renderCompare },
  'promo-extraction': { tab: renderPromoTab, run: renderPromoRun, compare: renderPromoCompare },
};

// The views of the flow `flowId`: { tab, run, compare }, each taking what
// main.js gives it ({ flow, runs, base, ticked } for the tab; { flow, id,
// runFile } for a run page; { flow, a, b } for a comparison) and returning
// the page's HTML.
export function viewsOf(flowId) {
  return VIEWS[flowId];
}
