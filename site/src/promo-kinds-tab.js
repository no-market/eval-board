// The promo kinds tab: the current eval set (see eval-sets.js), named in its
// heading, and the table of its runs, a row per index entry in the order
// given (the index is newest first). `base`, the run named as the baseline by
// the address: when it is of the current eval set, every other row shows its
// difference from it. `ticked`, the run ids ticked for comparing.
import { promosDifference, secondsDifference } from './differences.js';
import { currentEvalSet, evalSetName, inEvalSet } from './eval-sets.js';
import { flowById } from './flows.js';
import { formatDate, formatSeconds, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { costCell, costDifference, hardCases } from './promo-kinds-runs.js';
import { shareOf } from './promo-runs.js';
import { runAddress } from './route.js';
import { baseButton, baselineHint, compareButton, fromBase, rowClasses, runsLine, tickBox } from './tab-parts.js';

export function renderPromoKindsTab({ flow: flowId, runs: allRuns, base: baseId = null, ticked = [] }) {
  const flow = flowById(flowId);
  const evalSet = currentEvalSet(allRuns);
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
    ? table(flow, runs, base, ticked)
    : html`<p class="empty">No promo kinds eval runs yet. A run appears here once the backend publishes it to <code>runs/</code>.</p>`}
</main>`);
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
