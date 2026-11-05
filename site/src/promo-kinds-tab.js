// The promo kinds tab: the current eval set (see eval-sets.js), named in its
// heading, and the table of its runs, a row per index entry in the order
// given (the index is newest first). `base`, the run named as the baseline by
// the address: when it is of the current eval set, every other row shows its
// difference from it. `ticked`, the run ids ticked for comparing. Above the
// table, the chart with errors by group beside it; below it, folded, the
// history of runs on other eval sets. A point on the chart, and a column of
// errors by group, is a run, so a new prompt on one eval set stands beside
// the old one.
import { chart } from './chart.js';
import { promosDifference, secondsDifference } from './differences.js';
import { currentEvalSet, evalSetName, history, inEvalSet } from './eval-sets.js';
import { flowById } from './flows.js';
import { formatDate, formatSeconds, shortModel } from './format.js';
import { dash, html } from './html.js';
import { header } from './layout.js';
import { historyFold, VERDICT_COLUMNS } from './promo-history.js';
import { costCell, costDifference, costPerPromo, countOf, groupsInRuns, hardCases, promoCents } from './promo-kinds-runs.js';
import { shareOf } from './promo-runs.js';
import { runAddress } from './route.js';
import { baseButton, baselineHint, compareButton, fromBase, rowClasses, runsLine, tickBox } from './tab-parts.js';

// The chart's points (see chart.js): a run's cost per promo, the priced part
// when some calls weren't priced, and its error rate over promos.
const promos = {
  unit: 'promo',
  cost: (run) => costPerPromo(run.totals),
  share: (run) => run.totals.errors.share,
  models: (run) => `${run.prompt} · ${shortModel(run.model)}`,
  foot: 'Cost per promo, the run’s cost over its promos; the priced part when some calls weren’t priced',
  cents: promoCents,
};

export function renderPromoKindsTab({ flow: flowId, runs: allRuns, base: baseId = null, ticked = [] }) {
  const flow = flowById(flowId);
  // A run of part of the set doesn't take the tab from a full one.
  const evalSet = currentEvalSet(allRuns.filter((run) => run.full)) ?? currentEvalSet(allRuns);
  const runs = evalSet ? inEvalSet(allRuns, evalSet) : [];
  const base = runs.find((run) => run.run === baseId) ?? null;
  return String(html`${header(flow.id)}
<main style="--flow: ${flow.colour}">
  <div class="tab-head">
    <div class="heading">
      <h1 style="color: ${flow.colour}">${flow.name}</h1>
      ${evalSet ? html`<p class="muted">${runsLine(runs.length)} on the eval set <strong title="${evalSet.selection.join(', ')}">${evalSetName(evalSet)}</strong></p>${hardCases}` : ''}
    </div>
    ${evalSet ? compareButton(flow, runs, ticked) : ''}
  </div>
  ${evalSet
    ? html`<div class="beside">
    ${chart(runs, ticked, promos)}
    ${errorsByGroup(runs)}
  </div>
  ${table(flow, runs, base, ticked)}`
    : html`<p class="empty">No promo kinds eval runs yet. A run appears here once the backend publishes it to <code>runs/</code>.</p>`}
  ${historyFold(history(allRuns, evalSet), VERDICT_COLUMNS, (run) => pastRow(flow, run), 'promos')}
</main>`);
}

// Errors of `runs` by group: a row per group of any of them, in alphabetical
// order, and a column per run; `—` for a group a run lacks.
function errorsByGroup(runs) {
  return html`<section aria-labelledby="groups-h" class="groups">
    <h2 id="groups-h">Errors by group</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Group</th>
            ${runs.map((run) => html`<th scope="col" class="num" title="${run.prompt}"><div>${shortModel(run.model)}</div> <div class="small nowrap">${formatDate(run.date)}</div></th>`)}
          </tr>
        </thead>
        <tbody>${groupsInRuns(runs).map((group) => html`
          <tr>
            <th scope="row">${group}</th>
            ${runs.map((run) => html`<td class="num nowrap">${run.byGroup[group] ? countOf(run.byGroup[group]) : dash}</td>`)}
          </tr>`)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function pastRow(flow, run) {
  return html`
          <tr>
            <td class="nowrap"><a href="${runAddress(flow.id, run.run)}">${formatDate(run.date)}</a></td>
            <td>${run.prompt}</td>
            <td>${shortModel(run.model)}</td>
            <td><span title="${run.evalSet.selection.join(', ')}">${evalSetName(run.evalSet)}</span></td>
            ${VERDICT_COLUMNS.map(([, cell]) => html`<td class="num nowrap">${cell(run.totals)}</td>`)}
          </tr>`;
}

function table(flow, runs, base, ticked) {
  return html`<section aria-labelledby="runs-h" class="runs">
    <div class="runs-head">
      <h2 id="runs-h">Eval runs, newest first</h2>
      ${baselineHint(base)}
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col" class="tick"><span class="visually-hidden">Compare</span></th>
            <th scope="col">Date</th>
            <th scope="col">Prompt</th>
            <th scope="col">Model</th>
            <th scope="col" class="num">Promos</th>
            <th scope="col" class="num">Error rate</th>
            <th scope="col" class="num">Warning rate</th>
            <th scope="col" class="num">s / promo</th>
            <th scope="col" class="num">Cost / promo</th>
            <th scope="col" class="num">Baseline</th>
          </tr>
        </thead>
        <tbody>${runs.map((run) => row(flow, run, base, ticked))}</tbody>
      </table>
    </div>
    <p class="muted small">Shares in brackets are counted in promos. Seconds are the median per promo; cost is the run’s cost over its promos, ≥ the priced part when some calls weren’t priced.</p>
  </section>`;
}

function row(flow, run, base, ticked) {
  const isBase = run === base;
  const isTicked = ticked.includes(run.run);
  const diff = fromBase(base, run);
  return html`
          <tr${rowClasses(isBase, isTicked)}>
            ${tickBox(run, isTicked)}
            <td class="nowrap"><a href="${runAddress(flow.id, run.run)}">${formatDate(run.date)}</a></td>
            <td>${run.prompt}</td>
            <td>${shortModel(run.model)}</td>
            <td class="num">${run.totals.promos}</td>
            <td class="num nowrap"><div><strong>${shareOf(run.totals)}</strong></div>${diff((a, b) => promosDifference(a.totals.errors, b.totals.errors))}</td>
            <td class="num nowrap"><div>${shareOf(run.totals, 'warnings')}</div>${diff((a, b) => promosDifference(a.totals.warnings, b.totals.warnings))}</td>
            <td class="num nowrap"><div>${formatSeconds(run.totals.seconds.median)}</div>${diff((a, b) => secondsDifference(a.totals.seconds.median, b.totals.seconds.median))}</td>
            <td class="num nowrap"><div>${costCell(run.totals)}</div>${diff((a, b) => costDifference(a.totals, b.totals))}</td>
            <td class="num base-cell">${baseButton(flow, run, isBase)}</td>
          </tr>`;
}
