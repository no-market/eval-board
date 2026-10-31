// A promo run page: the promo run `id` (its file name without `.json`), from
// its `runFile`, laid out in the order of the backend's job summary
// (evals/promo_summary.py): a heading, one table in total and by chain, per
// page, errors, and warnings folded. A run scored before verdicts
// (schema_version 3) has matched, missed and made-up promos in the table
// instead, and no lists of promos.
//
// The repo is public (ADR-0006): promo records show, but leaflet files, page
// images and raw leaflet text never do; a page links only to its own leaflet.
import { flowById } from './flows.js';
import { formatDate, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { renderNotFound } from './not-found.js';
import { chainName } from './promo-runs.js';
import { runFileOnGitHub } from './runs.js';

export function renderPromoRun({ flow: flowId, id, runFile }) {
  if (!runFile) return renderNotFound(`There is no eval run ${id}.`, flowId);
  const flow = flowById(flowId);
  return String(html`${header(flow.id)}
<main class="run promo" style="--flow: ${flow.colour}">
  ${heading(flow, runFile)}
  <p><a href="${runFileOnGitHub(id)}">Run file on GitHub</a></p>
</main>`);
}

// The chains of a run, in alphabetical order.
const chainsOf = (runFile) => Object.keys(runFile.by_chain).sort();
const configOf = (runFile, chain) => runFile.chain_configs?.[chain] ?? runFile.config;

function heading(flow, runFile) {
  const pages = runFile.cases.length;
  return html`<div class="heading">
    <a class="back" href="#/${flow.id}">← All promo runs</a>
    <h1>Promo eval run, ${formatDate(runFile.date)}</h1>
    <div class="facts">
      <span>Prompt <strong>${runFile.config.version}</strong></span>
      ${chainsOf(runFile).map((chain) => {
        const { model, strategy } = configOf(runFile, chain);
        return html`<span>${chainName(chain)} <strong>${shortModel(model)}</strong> · ${strategy}</span>`;
      })}
      <span>Commit <a class="mono" href="https://github.com/no-market/backend/commit/${runFile.commit}">${runFile.commit.slice(0, 7)}</a></span>
    </div>
    <div class="pills">
      <span class="pill">Dataset <code>${runFile.dataset_revision}</code> · scorer <code>${runFile.scorer_version}</code></span>
      <span class="pill">${runFile.selection.length} of ${runFile.eligible.length} pages, ${runFile.full ? 'full' : 'not full'}</span>
      <span class="pill">Failed: ${runFile.totals.failed_pages} of ${pages} pages</span>
    </div>
  </div>`;
}
