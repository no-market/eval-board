// The history of the promos tab: every run not of the current eval set (see
// eval-sets.js), folded below the table, newest first, each with its eval set
// named. Runs with verdicts and runs scored before them (schema_version 3)
// have different numbers, so each kind is a table of its own. History runs
// are neither ticked nor set as the baseline, and carry no differences.
import { evalSetName, hasVerdicts, history } from './eval-sets.js';
import { formatDate, formatShare } from './format.js';
import { html } from './html.js';
import { modelsLine, strategiesLine } from './promo-runs.js';
import { runAddress } from './route.js';

// The folded history of `runs` against `evalSet`, the current one (null when
// there is none); nothing when every run is of it.
export function historySection(flow, runs, evalSet) {
  const past = history(runs, evalSet);
  if (!past.length) return '';
  const withVerdicts = past.filter(hasVerdicts);
  const without = past.filter((run) => !hasVerdicts(run));
  return html`<details class="block-fold history">
    <summary>Runs on other eval sets · ${past.length} <span class="muted">— another dataset revision, scorer or pages, so their numbers don’t compare with the table above</span></summary>
    ${withVerdicts.length ? historyTable(flow, withVerdicts, VERDICT_COLUMNS) : ''}
    ${without.length ? historyTable(flow, without, MATCHING_COLUMNS) : ''}
  </details>`;
}

// The numbers of a run with verdicts, as [heading, cell].
const VERDICT_COLUMNS = [
  ['Error rate', (totals) => shareOf(totals, 'errors')],
  ['Warning rate', (totals) => shareOf(totals, 'warnings')],
];

// The numbers of a run scored before verdicts, as [heading, cell]: promos
// matched to the truth, missed and made up.
const MATCHING_COLUMNS = [
  ['Matched', (totals) => html`${totals.matched} <span class="muted">of ${totals.truth}</span>`],
  ['Missed', (totals) => totals.missed],
  ['Made up', (totals) => totals.extra],
  ['Recall', (totals) => shareOrDash(totals.recall)],
  ['Precision', (totals) => shareOrDash(totals.precision)],
  ['Failed pages', (totals) => totals.failedPages],
];

function historyTable(flow, runs, columns) {
  return html`<div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Prompt</th>
            <th scope="col">Model</th>
            <th scope="col">Eval set</th>
            ${columns.map(([heading]) => html`<th scope="col" class="num">${heading}</th>`)}
          </tr>
        </thead>
        <tbody>${runs.map((run) => html`
          <tr>
            <td class="nowrap"><a href="${runAddress(flow.id, run.run)}">${formatDate(run.date)}</a></td>
            <td>${run.prompt}</td>
            <td><span title="${strategiesLine(run.configs)}">${modelsLine(run.configs)}</span></td>
            <td><span title="${run.evalSet.selection.join(', ')}">${evalSetName(run.evalSet)}</span></td>
            ${columns.map(([, cell]) => html`<td class="num nowrap">${cell(run.totals)}</td>`)}
          </tr>`)}
        </tbody>
      </table>
    </div>`;
}

function shareOrDash(share) {
  return share === null || share === undefined ? html`<span class="muted">—</span>` : formatShare(share);
}

// `45.5% (10 of 22)`: the errors (or warnings) of `totals`, counted in promos.
function shareOf(totals, of) {
  const { count, share } = totals[of];
  return html`${formatShare(share)} <span class="muted">(${count} of ${totals.promos})</span>`;
}
