// The promos tab: the current eval set (see eval-sets.js), named in its
// heading, and the table of its runs, a row per index entry in the order
// given (the index is newest first). Runs of other eval sets are left out.
// `base`, the run named as the baseline by the address: when it is of the
// current eval set, every other row shows its difference from it. `ticked`,
// the run ids ticked for comparing (see ticking.js), as on the receipt lines tab.
import { centsDifference, promosDifference, secondsDifference } from './differences.js';
import { currentEvalSet, evalSetName, inEvalSet } from './eval-sets.js';
import { flowById } from './flows.js';
import { formatCents, formatDate, formatSeconds, formatShare } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { chainName, chainsOf, costPerPage, modelsLine, strategiesLine } from './promo-runs.js';
import { runAddress } from './route.js';
import { baseButton, baselineHint, compareButton, fromBase, rowClasses, runsLine, tickBox } from './tab-parts.js';

const dash = html`<span class="muted">—</span>`;

export function renderPromoTab({ flow: flowId, runs: allRuns, base: baseId = null, ticked = [] }) {
  const flow = flowById(flowId);
  const evalSet = currentEvalSet(allRuns);
  const runs = evalSet ? inEvalSet(allRuns, evalSet) : [];
  const base = runs.find((run) => run.run === baseId) ?? null;
  return String(html`${header(flow.id)}
<main style="--flow: ${flow.colour}">
  <div class="tab-head">
    <div class="heading">
      <h1 style="color: ${flow.colour}">${flow.name}</h1>
      ${evalSet ? html`<p class="muted">${runsLine(runs.length)} on the eval set <strong title="${evalSet.selection.join(', ')}">${evalSetName(evalSet)}</strong> · each is one prompt and a model per chain on every page of the eval set</p>` : ''}
    </div>
    ${evalSet ? compareButton(flow, runs, ticked) : ''}
  </div>
  ${evalSet
    ? table(flow, runs, base, ticked)
    : html`<p class="empty">No promo eval runs with verdicts yet. A run appears here once the backend publishes it to <code>runs/</code>.</p>`}
</main>`);
}

function table(flow, runs, base, ticked) {
  const chains = chainsOf(runs);
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
            <th scope="col" class="num">Pages</th>
            <th scope="col" class="num">Error rate</th>
            ${chains.map((chain) => html`<th scope="col" class="num" title="Error rate of ${chainName(chain)}’s promos">${chainName(chain)}</th>`)}
            <th scope="col" class="num">Warning rate</th>
            <th scope="col" class="num">s / page</th>
            <th scope="col" class="num">Cost / page</th>
            <th scope="col" class="num">Baseline</th>
          </tr>
        </thead>
        <tbody>${runs.map((run) => row(flow, run, chains, base, ticked))}</tbody>
      </table>
    </div>
    <p class="muted small">Shares in brackets are counted in promos: every reviewed promo of the pages, and every made-up one; a chain’s column, of that chain’s. Seconds are the median per page; cost is the run’s cost over its pages, ≥ the priced part when some calls weren’t priced.</p>
  </section>`;
}

function row(flow, run, chains, base, ticked) {
  const isBase = run === base;
  const isTicked = ticked.includes(run.run);
  const diff = fromBase(base, run);
  return html`
          <tr${rowClasses(isBase, isTicked)}>
            ${tickBox(run, isTicked)}
            <td class="nowrap"><a href="${runAddress(flow.id, run.run)}">${formatDate(run.date)}</a></td>
            <td>${run.prompt}</td>
            <td><span title="${strategiesLine(run.configs)}">${modelsLine(run.configs)}</span></td>
            <td class="num">${run.totals.pages}</td>
            <td class="num nowrap"><div><strong>${shareOf(run.totals)}</strong></div>${diff((a, b) => promosDifference(a.totals.errors, b.totals.errors))}</td>
            ${chains.map((chain) => chainCell(run, chain, diff))}
            <td class="num nowrap"><div>${shareOf(run.totals, 'warnings')}</div>${diff((a, b) => promosDifference(a.totals.warnings, b.totals.warnings))}</td>
            <td class="num nowrap"><div>${formatSeconds(run.totals.seconds.median)}</div>${diff((a, b) => secondsDifference(a.totals.seconds.median, b.totals.seconds.median))}</td>
            <td class="num nowrap"><div>${cost(costPerPage(run.totals))}</div>${diff(costDifference)}</td>
            <td class="num base-cell">${baseButton(flow, run, isBase)}</td>
          </tr>`;
}

// A chain's error rate, with its difference from the baseline's when both
// runs have the chain.
function chainCell(run, chain, diff) {
  const numbers = run.byChain[chain];
  if (!numbers) return html`<td class="num">${dash}</td>`;
  return html`<td class="num nowrap"><div>${shareOf(numbers)}</div>${diff((a, b) =>
    a.byChain[chain] ? promosDifference(a.byChain[chain].errors, b.byChain[chain].errors) : null,
  )}</td>`;
}

// `45.5% (10 of 22)`: the errors (or warnings) of `numbers`, counted in promos.
function shareOf(numbers, of = 'errors') {
  const { count, share } = numbers[of];
  return html`${formatShare(share)} <span class="muted">(${count} of ${numbers.promos})</span>`;
}

// `0.15¢`, or `≥ 0.08¢` for the priced part of a cost.
function cost(perPage) {
  if (!perPage) return dash;
  if (perPage.priced) return formatCents(perPage.usd);
  return html`<span title="Some calls were not priced: this is the priced part">≥ ${formatCents(perPage.usd)}</span>`;
}

// The difference in cost per page, only when both costs are known in full.
function costDifference(a, b) {
  const [costA, costB] = [costPerPage(a.totals), costPerPage(b.totals)];
  if (!costA?.priced || !costB?.priced) return null;
  return centsDifference(costA.usd, costB.usd);
}
