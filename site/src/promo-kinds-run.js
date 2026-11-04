// A promo kinds run page: the run `id` (its file name without `.json`), from
// its `runFile`, in the shape of the backend's job summary for this flow: a
// heading, a table of its numbers, errors by group, each error, and warnings
// folded.
//
// The repo is public (ADR-0006): promo wording shows; prompts and the kind
// list as sent are never in a run file.
import { flowById } from './flows.js';
import { formatDate, formatSeconds, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { renderNotFound } from './not-found.js';
import { answeredKinds, costCell, expectedKinds, groupsInRuns, hardCases, promoCell, promoKindsRun } from './promo-kinds-runs.js';
import { shareOf } from './promo-runs.js';
import { runFileOnGitHub } from './runs.js';

export function renderPromoKindsRun({ flow: flowId, id, runFile }) {
  if (!runFile) return renderNotFound(`There is no eval run ${id}.`, flowId);
  const flow = flowById(flowId);
  const run = promoKindsRun(runFile);
  const withVerdict = (verdict) => runFile.cases.filter((promo) => promo.verdict === verdict);
  return String(html`${header(flow.id)}
<main class="run promo" style="--flow: ${flow.colour}">
  ${heading(flow, run, runFile)}
  ${summary(run)}
  ${hardCases}
  ${byGroup(run)}
  ${errors(withVerdict('error'))}
  ${warnings(withVerdict('warning'))}
  <p><a href="${runFileOnGitHub(id)}">Run file on GitHub</a></p>
</main>`);
}

// `run`, the run file as promoKindsRun reads it; the selection from the run
// file itself.
function heading(flow, run, runFile) {
  return html`<div class="heading">
    <a class="back" href="#/${flow.id}">← All promo kinds runs</a>
    <h1>Promo kinds eval run, ${formatDate(run.date)}</h1>
    <div class="facts">
      <span>Prompt <strong>${run.prompt}</strong></span>
      <span>Model <strong>${shortModel(run.model)}</strong></span>
      <span>Commit <a class="mono" href="https://github.com/no-market/backend/commit/${run.commit}">${run.commit.slice(0, 7)}</a></span>
    </div>
    <div class="pills">
      <span class="pill">Dataset <code>${run.evalSet.dataset}</code> · scorer <code>${run.evalSet.scorer}</code></span>
      <span class="pill">${runFile.selection.length} of ${runFile.eligible.length} promos, ${runFile.full ? 'full' : 'not full'}</span>
      <span class="pill">Failed: ${run.totals.failed} of ${run.totals.promos} promos</span>
    </div>
  </div>`;
}

function summary({ totals }) {
  const row = (label, value) => html`
        <tr><th scope="row">${label}</th><td class="total">${value}</td></tr>`;
  return html`<section aria-labelledby="summary-h" class="block">
    <h2 id="summary-h">Summary</h2>
    <div class="table-wrap">
      <table class="summary">
        <thead><tr><th scope="col"></th><th scope="col" class="total">Total</th></tr></thead>
        <tbody>${[
          row('Errors', shareOf(totals, 'errors')),
          row('Warnings', shareOf(totals, 'warnings')),
          row('Seconds per promo, median (p95)', html`${formatSeconds(totals.seconds.median)} <span class="muted">(${formatSeconds(totals.seconds.p95)})</span>`),
          row('Cost per promo', costCell(totals)),
        ]}
        </tbody>
      </table>
    </div>
  </section>`;
}

// A row per group, in alphabetical order.
function byGroup({ byGroup: groups }) {
  return html`<section aria-labelledby="groups-h" class="block">
    <h2 id="groups-h">Errors by group</h2>
    <div class="table-wrap">
      <table class="receipts">
        <thead><tr><th scope="col">Group</th><th scope="col">Promos</th><th scope="col">Errors</th><th scope="col">Warnings</th></tr></thead>
        <tbody>${groupsInRuns([{ byGroup: groups }]).map((group) => html`
          <tr><th scope="row">${group}</th><td>${groups[group].promos}</td><td>${shareOf(groups[group])}</td><td>${shareOf(groups[group], 'warnings')}</td></tr>`)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function errors(promos) {
  return html`<section aria-labelledby="errors-h" class="block">
    <h2 id="errors-h">Errors <span class="muted">· ${promos.length}</span></h2>
    ${promos.length === 0
      ? html`<p class="muted">No promo has an error.</p>`
      : html`<div class="table-wrap">
      <table class="lines">
        <thead><tr><th scope="col">Promo</th><th scope="col">Reasons</th><th scope="col">Expected</th><th scope="col">Answered</th></tr></thead>
        <tbody>${promos.map((promo) => html`
          <tr><td>${promoCell(promo)}</td><td class="mono">${promo.errors.join(', ')}</td><td>${expectedKinds(promo.expected)}</td><td>${answeredKinds(promo)}</td></tr>`)}
        </tbody>
      </table>
    </div>`}
  </section>`;
}

// Each warning as the truth's kinds to the names the run created, for the
// founder to read. The run file doesn't say which of the truth's kinds was
// due, so all of them show.
function warnings(promos) {
  return html`<details class="block-fold">
    <summary>Warnings · ${promos.length}</summary>
    ${promos.length === 0
      ? html`<p class="muted">No promo has a warning.</p>`
      : html`<div class="table-wrap">
      <table class="lines">
        <thead><tr><th scope="col">Promo</th><th scope="col">Reasons</th><th scope="col">Truth</th><th scope="col">Created</th></tr></thead>
        <tbody>${promos.map((promo) => html`
          <tr><td>${promoCell(promo)}</td><td class="mono">${promo.warnings.join(', ')}</td><td>${expectedKinds(promo.expected)}</td><td>${answeredKinds(promo)}</td></tr>`)}
        </tbody>
      </table>
    </div>`}
  </details>`;
}
