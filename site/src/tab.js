import { chart } from './chart.js';
import { flowById } from './flows.js';
import { centsDifference, linesDifference, secondsDifference } from './differences.js';
import { formatCents, formatDate, formatSeconds, formatShare } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { runAddress } from './route.js';
import { modelPair } from './runs.js';
import { baseButton, baselineHint, compareButton, fromBase, rowClasses, runsLine, tickBox } from './tab-parts.js';

// The receipt lines tab: its heading, the chart of its runs (see chart.js)
// and the table of them, a row per index entry, in the order given (the index is newest first). `base`, the run named as
// the baseline by the address, if any: every other row shows its difference
// from it. `ticked`, the run ids ticked for comparing (see ticking.js): their
// boxes are ticked, and with two a button opens their comparison.
export function renderTab({ flow: flowId, runs, base: baseId = null, ticked = [] }) {
  const flow = flowById(flowId);
  const base = runs.find((run) => run.run === baseId) ?? null;
  return String(html`${header(flow.id)}
<main style="--flow: ${flow.colour}">
  <div class="tab-head">
    <div class="heading">
      <h1 style="color: ${flow.colour}">${flow.name}</h1>
      <p class="muted">${runsLine(runs.length)} · each is one reading model and one kind choice model on every reviewed photo</p>
    </div>
    ${runs.length === 0 ? '' : compareButton(flow, runs, ticked)}
  </div>
  ${runs.length === 0 ? html`<p class="empty">No eval runs yet. A run appears here once the backend publishes it to <code>runs/</code>.</p>` : html`${chart(runs, ticked)}
  ${table(flow, runs, base, ticked)}`}
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
            <th scope="col">Flow · reading · kind choice</th>
            <th scope="col" class="num">Receipts</th>
            <th scope="col" class="num">Error rate</th>
            <th scope="col" class="num">Warning rate</th>
            <th scope="col" class="num">s / receipt</th>
            <th scope="col" class="num">Cost / receipt</th>
            <th scope="col" class="num">Baseline</th>
          </tr>
        </thead>
        <tbody>${runs.map((run) => row(flow, run, base, ticked))}</tbody>
      </table>
    </div>
    <p class="muted small">Shares in brackets are counted in lines. Seconds are the median per receipt; cost is the mean per receipt that didn't fail.</p>
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
            <td><span class="muted">${run.flowVersion} · </span><span title="${run.models.read} · ${run.models.chooseKinds}">${modelPair(run.models.read, run.models.chooseKinds)}</span></td>
            <td class="num">${run.receipts}</td>
            <td class="num nowrap"><div><strong>${shareOf(run.errors, run.lines)}</strong></div>${diff((a, b) => linesDifference(a.errors, b.errors))}</td>
            <td class="num nowrap"><div>${shareOf(run.warnings, run.lines)}</div>${diff((a, b) => linesDifference(a.warnings, b.warnings))}</td>
            <td class="num nowrap"><div>${formatSeconds(run.seconds.median)}</div>${diff((a, b) => secondsDifference(a.seconds.median, b.seconds.median))}</td>
            <td class="num nowrap"><div>${formatCents(run.costUsd)}</div>${diff((a, b) => centsDifference(a.costUsd, b.costUsd))}</td>
            <td class="num base-cell">${baseButton(flow, run, isBase)}</td>
          </tr>`;
}

// `11.6% (5 of 43)`: a share with the lines it rests on.
function shareOf({ count, share }, lines) {
  return html`${formatShare(share)} <span class="muted">(${count} of ${lines})</span>`;
}
