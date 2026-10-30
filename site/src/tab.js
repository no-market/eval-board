import { flowById } from './flows.js';
import { formatCents, formatDate, formatSeconds, formatShare, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';

// A flow's tab: its heading and the table of its runs, a row per index entry,
// in the order given (the index is newest first).
export function renderTab({ flow: flowId, runs }) {
  const flow = flowById(flowId);
  return String(html`${header(flow.id)}
<main style="--flow: ${flow.colour}">
  <div class="heading">
    <h1 style="color: ${flow.colour}">${flow.name}</h1>
    <p class="muted">${runsLine(runs.length)} · each is one reading model and one kind choice model on every reviewed photo</p>
  </div>
  ${runs.length === 0 ? html`<p class="empty">No eval runs yet. A run appears here once the backend publishes it to <code>runs/</code>.</p>` : table(flow, runs)}
</main>`);
}

function runsLine(n) {
  return n === 1 ? '1 eval run' : `${n} eval runs`;
}

function table(flow, runs) {
  return html`<section aria-labelledby="runs-h" class="runs">
    <h2 id="runs-h">Eval runs, newest first</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Flow · reading · kind choice</th>
            <th scope="col" class="num">Receipts</th>
            <th scope="col" class="num">Error rate</th>
            <th scope="col" class="num">Warning rate</th>
            <th scope="col" class="num">s / receipt</th>
            <th scope="col" class="num">Cost / receipt</th>
          </tr>
        </thead>
        <tbody>${runs.map((run) => row(flow, run))}</tbody>
      </table>
    </div>
    <p class="muted small">Shares in brackets are counted in lines. Seconds are the median per receipt; cost is the mean per receipt that didn't fail.</p>
  </section>`;
}

function row(flow, run) {
  return html`
          <tr>
            <td class="nowrap"><a href="#/${flow.id}/run/${run.run}">${formatDate(run.date)}</a></td>
            <td><span class="muted">${run.flowVersion} · </span><span title="${run.models.read}">${shortModel(run.models.read)}</span><span class="muted"> · </span><span title="${run.models.chooseKinds}">${shortModel(run.models.chooseKinds)}</span></td>
            <td class="num">${run.receipts}</td>
            <td class="num nowrap"><strong>${shareOf(run.errors, run.lines)}</strong></td>
            <td class="num nowrap">${shareOf(run.warnings, run.lines)}</td>
            <td class="num nowrap">${formatSeconds(run.seconds.median)}</td>
            <td class="num nowrap">${formatCents(run.costUsd)}</td>
          </tr>`;
}

// `11.6% (5 of 43)`: a share with the lines it rests on.
function shareOf({ count, share }, lines) {
  return html`${formatShare(share)} <span class="muted">(${count} of ${lines})</span>`;
}
