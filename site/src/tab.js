import { flowById } from './flows.js';
import { centsDifference, linesDifference, secondsDifference } from './differences.js';
import { formatCents, formatDate, formatSeconds, formatShare, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { tabAddress } from './route.js';

// A flow's tab: its heading and the table of its runs, a row per index entry,
// in the order given (the index is newest first). `base`, the run named as
// the baseline by the address, if any: every other row shows its difference
// from it.
export function renderTab({ flow: flowId, runs, base: baseId = null }) {
  const flow = flowById(flowId);
  const base = runs.find((run) => run.run === baseId) ?? null;
  return String(html`${header(flow.id)}
<main style="--flow: ${flow.colour}">
  <div class="heading">
    <h1 style="color: ${flow.colour}">${flow.name}</h1>
    <p class="muted">${runsLine(runs.length)} · each is one reading model and one kind choice model on every reviewed photo</p>
  </div>
  ${runs.length === 0 ? html`<p class="empty">No eval runs yet. A run appears here once the backend publishes it to <code>runs/</code>.</p>` : table(flow, runs, base)}
</main>`);
}

function runsLine(n) {
  return n === 1 ? '1 eval run' : `${n} eval runs`;
}

function table(flow, runs, base) {
  return html`<section aria-labelledby="runs-h" class="runs">
    <div class="runs-head">
      <h2 id="runs-h">Eval runs, newest first</h2>
      <span class="muted small">${base ? `Differences against the baseline, ${formatDate(base.date)}` : 'Set a baseline with a row’s “Set as baseline” to see every other run against it'} · <span class="better">▼ better</span> · <span class="worse">▲ worse</span></span>
    </div>
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
            <th scope="col" class="num">Baseline</th>
          </tr>
        </thead>
        <tbody>${runs.map((run) => row(flow, run, base))}</tbody>
      </table>
    </div>
    <p class="muted small">Shares in brackets are counted in lines. Seconds are the median per receipt; cost is the mean per receipt that didn't fail.</p>
  </section>`;
}

function row(flow, run, base) {
  const isBase = run === base;
  // The difference under a number: none on the baseline's row or without one.
  const under = (difference) => {
    if (!base || isBase) return '';
    const { mark, text } = difference(base, run);
    return html`<div class="diff ${mark}">${text}</div>`;
  };
  return html`
          <tr${isBase ? html` class="base"` : ''}>
            <td class="nowrap"><a href="#/${flow.id}/run/${run.run}">${formatDate(run.date)}</a></td>
            <td><span class="muted">${run.flowVersion} · </span><span title="${run.models.read}">${shortModel(run.models.read)}</span><span class="muted"> · </span><span title="${run.models.chooseKinds}">${shortModel(run.models.chooseKinds)}</span></td>
            <td class="num">${run.receipts}</td>
            <td class="num nowrap"><div><strong>${shareOf(run.errors, run.lines)}</strong></div>${under((a, b) => linesDifference(a.errors, b.errors))}</td>
            <td class="num nowrap"><div>${shareOf(run.warnings, run.lines)}</div>${under((a, b) => linesDifference(a.warnings, b.warnings))}</td>
            <td class="num nowrap"><div>${formatSeconds(run.seconds.median)}</div>${under((a, b) => secondsDifference(a.seconds.median, b.seconds.median))}</td>
            <td class="num nowrap"><div>${formatCents(run.costUsd)}</div>${under((a, b) => centsDifference(a.costUsd, b.costUsd))}</td>
            <td class="num">${baseButton(flow, run, isBase)}</td>
          </tr>`;
}

// `11.6% (5 of 43)`: a share with the lines it rests on.
function shareOf({ count, share }, lines) {
  return html`${formatShare(share)} <span class="muted">(${count} of ${lines})</span>`;
}

// A link, as the baseline lives only in the address: it sets this run as the
// baseline, or on the baseline's row clears it.
function baseButton(flow, run, isBase) {
  const date = formatDate(run.date);
  return isBase
    ? html`<a class="base-button" href="${tabAddress(flow.id, null)}" aria-pressed="true" role="button" aria-label="Clear the baseline, the run of ${date}">Baseline ✕</a>`
    : html`<a class="base-button" href="${tabAddress(flow.id, run.run)}" aria-pressed="false" role="button" aria-label="Set the run of ${date} as baseline">Set as baseline</a>`;
}
