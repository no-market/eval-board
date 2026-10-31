// The history of the promos tab: every run not of the current eval set (see
// eval-sets.js), folded below the table in one table, newest first, each with
// its eval set named. A run with verdicts shows its error and warning rates;
// a run scored before them (schema_version 3) its matched, missed and made-up
// promos, recall, precision and failed pages; each `—` where the other kind's
// numbers are. History runs are neither ticked nor set as the baseline, and
// carry no differences.
import { evalSetName, hasVerdicts, history } from './eval-sets.js';
import { formatDate } from './format.js';
import { dash, html } from './html.js';
import { MATCHING_COLUMNS, modelsLine, shareOf, strategiesLine } from './promo-runs.js';
import { runAddress } from './route.js';

// The numbers of a run with verdicts, as [heading, cell of its totals].
const VERDICT_COLUMNS = [
  ['Error rate', (totals) => shareOf(totals, 'errors')],
  ['Warning rate', (totals) => shareOf(totals, 'warnings')],
];

// The numbers of a run scored before verdicts.
const BEFORE_COLUMNS = [...MATCHING_COLUMNS, ['Failed pages', (totals) => totals.failedPages]];

// The folded history of `runs` against `evalSet`, the current one (null when
// there is none); nothing when every run is of it.
export function historySection(flow, runs, evalSet) {
  const past = history(runs, evalSet);
  if (!past.length) return '';
  return html`<details class="block-fold history">
    <summary>Runs on other eval sets · ${past.length} <span class="muted">— another dataset revision, scorer or pages, so their numbers don’t compare with the table above</span></summary>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Prompt</th>
            <th scope="col">Model</th>
            <th scope="col">Eval set</th>
            ${[...VERDICT_COLUMNS, ...BEFORE_COLUMNS].map(([heading]) => html`<th scope="col" class="num">${heading}</th>`)}
          </tr>
        </thead>
        <tbody>${past.map((run) => row(flow, run))}
        </tbody>
      </table>
    </div>
  </details>`;
}

function row(flow, run) {
  const verdicts = hasVerdicts(run);
  const cells = (columns, shown) =>
    columns.map(([, cell]) => html`<td class="num nowrap">${shown ? cell(run.totals) : dash}</td>`);
  return html`
          <tr>
            <td class="nowrap"><a href="${runAddress(flow.id, run.run)}">${formatDate(run.date)}</a></td>
            <td>${run.prompt}</td>
            <td><span title="${strategiesLine(run.configs)}">${modelsLine(run.configs)}</span></td>
            <td><span title="${run.evalSet.selection.join(', ')}">${evalSetName(run.evalSet)}</span></td>
            ${cells(VERDICT_COLUMNS, verdicts)}${cells(BEFORE_COLUMNS, !verdicts)}
          </tr>`;
}
