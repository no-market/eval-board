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
import { formatCents, formatDate, formatSeconds, formatShare, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { renderNotFound } from './not-found.js';
import { chainName, costPerPage } from './promo-runs.js';
import { dash } from './run.js';
import { runFileOnGitHub } from './runs.js';

export function renderPromoRun({ flow: flowId, id, runFile }) {
  if (!runFile) return renderNotFound(`There is no eval run ${id}.`, flowId);
  const flow = flowById(flowId);
  return String(html`${header(flow.id)}
<main class="run promo" style="--flow: ${flow.colour}">
  ${heading(flow, runFile)}
  ${summary(runFile)}
  ${perPage(runFile.cases)}
  ${errors(promosWith(runFile.cases, 'error'))}
  ${warnings(promosWith(runFile.cases, 'warning'))}
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

const orDash = (value, format) => (value === null || value === undefined ? dash : format(value));

// The table of the run: a column for the total and one per chain, each over
// its own pages; with verdicts, errors and warnings, else matched, missed and
// made-up promos with recall and precision.
function summary(runFile) {
  const columns = [
    { name: 'Total', numbers: runFile.totals, pages: runFile.cases.length },
    ...chainsOf(runFile).map((chain) => ({
      name: chainName(chain),
      numbers: runFile.by_chain[chain],
      pages: runFile.cases.filter((c) => c.chain === chain).length,
    })),
  ];
  const row = (label, value) => html`
        <tr><th scope="row">${label}</th>${columns.map((column, i) => html`<td${i === 0 ? html` class="total"` : ''}>${value(column)}</td>`)}</tr>`;
  return html`<section aria-labelledby="summary-h" class="block">
    <h2 id="summary-h">Summary by chain</h2>
    <div class="table-wrap">
      <table class="summary">
        <thead><tr><th scope="col"></th>${columns.map(({ name }, i) => html`<th scope="col"${i === 0 ? html` class="total"` : ''}>${name}</th>`)}</tr></thead>
        <tbody>${[
          row('Errors', ({ numbers }) => promosOf(numbers.errors, numbers.promos)),
          row('Warnings', ({ numbers }) => promosOf(numbers.warnings, numbers.promos)),
          row('Seconds per page, median (p95)', ({ numbers }) => html`${orDash(numbers.p50_seconds, formatSeconds)} <span class="muted">(${orDash(numbers.p95_seconds, formatSeconds)})</span>`),
          row('Cost per page', cost),
        ]}
        </tbody>
      </table>
    </div>
  </section>`;
}

// `9 of 22 (40.9%)`: a count of promos out of the promos scored.
function promosOf(count, promos) {
  if (!count) return dash;
  return html`<strong>${count.count}</strong> of ${promos} <span class="muted">(${formatShare(count.share)})</span>`;
}

// Cost per page; the priced part marked ≥ when some calls weren't priced.
function cost({ numbers, pages }) {
  const perPage = costPerPage({ costUsd: numbers.cost_usd, knownCostUsd: numbers.known_cost_usd, pages });
  if (!perPage) return dash;
  if (perPage.priced) return formatCents(perPage.usd);
  return html`<span title="Some calls were not priced; this is the priced part">≥ ${formatCents(perPage.usd)}</span>`;
}

function perPage(cases) {
  return html`<section aria-labelledby="pages-h" class="block">
    <h2 id="pages-h">Per page</h2>
    <div class="table-wrap">
      <table class="receipts">
        <thead><tr><th scope="col">Page</th><th scope="col">Promos</th><th scope="col">Errors</th><th scope="col">Warnings</th><th scope="col">Seconds</th><th scope="col">Cost</th></tr></thead>
        <tbody>${cases.map(pageRow)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function pageRow(page) {
  const name = html`<th scope="row">${pageName(page)}</th>`;
  const spent = html`<td>${orDash(page.seconds, formatSeconds)}</td><td>${orDash(page.usage?.cost_usd, formatCents)}</td>`;
  if (page.failed) {
    return html`
          <tr class="failed">${name}<td colspan="3"><strong>Failed:</strong> ${page.failure}</td>${spent}</tr>`;
  }
  const promos = page.promos ?? [];
  const count = (verdict) => promos.filter((promo) => promo.verdict === verdict).length;
  const unscored = page.unscored?.length ? html` <span class="muted">· ${page.unscored.length} unscored</span>` : '';
  return html`
          <tr>${name}<td>${promos.length}${unscored}</td><td>${count('error')}</td><td>${count('warning')}</td>${spent}</tr>`;
}

// `Biedronka p. 4 · leaflet`, the page's id on hover and a link to its own
// leaflet: only a web address, never a leaflet file or page image.
function pageName(page) {
  const leaflet = /^https?:\/\//.test(page.source_url ?? '') ? html` · <a href="${page.source_url}">leaflet</a>` : '';
  return html`<span title="${page.id}">${chainName(page.chain)} p. ${page.page}</span>${leaflet}`;
}

// The promos with the verdict, in page order, each with its page.
function promosWith(cases, verdict) {
  return cases.flatMap((page) =>
    (page.promos ?? []).filter((promo) => promo.verdict === verdict).map((promo) => ({ page, promo })),
  );
}

function errors(promos) {
  return html`<section aria-labelledby="errors-h" class="block">
    <h2 id="errors-h">Errors <span class="muted">· ${promos.length}</span></h2>
    <div class="table-wrap">${promosTable(promos, 'errors')}</div>
  </section>`;
}

function warnings(promos) {
  return html`<details class="block-fold">
    <summary>Warnings · ${promos.length}</summary>
    <div class="table-wrap">${promosTable(promos, 'warnings')}</div>
  </details>`;
}

// `list`: which of a promo's lists of fields the table names, its `errors`
// or its `warnings`.
function promosTable(promos, list) {
  return html`
      <table class="lines">
        <thead><tr><th scope="col">Page</th><th scope="col">Promo</th><th scope="col">Fields</th><th scope="col">Expected</th><th scope="col">Actual</th></tr></thead>
        <tbody>${promos.map(({ page, promo }) => {
          const [expected, actual] = expectedAndActual(page, promo, promo[list]);
          return html`
          <tr><td class="nowrap">${pageName(page)}</td><td>${promo.name}</td><td class="mono">${promo[list].join(', ')}</td><td>${expected}</td><td>${actual}</td></tr>`;
        })}
        </tbody>
      </table>`;
}

// What was expected of a promo and what was read: a missed promo's whole
// promo, a made-up one's, or each difference under the `fields` named.
function expectedAndActual(page, promo, fields) {
  if (promo.prediction === null) return ['on the page', html`${dash} <span class="muted">(missed)</span>`];
  if (promo.truth === null) return [html`${dash} <span class="muted">(not on the page)</span>`, 'made up'];
  const named = differencesOf(page, promo, fields);
  return [named.map((d) => value(d.field, d.expected)), named.map((d) => value(d.field, d.actual))];
}

// The differences of a promo under the `fields` its verdict names, as
// { field, expected, actual }. A field names its parts too: `lowest_30_days`
// its `lowest_30_days.amount`. A difference of all the conditions, as when
// none were expected, gives only the parts that differ.
function differencesOf(page, promo, fields) {
  const named = (field) => fields.some((f) => field === f || field.startsWith(`${f}.`));
  return page.differences
    .filter((d) => d.prediction === promo.prediction && d.truth === promo.truth)
    .flatMap((d) => (d.field === 'conditions' ? conditionParts(d) : [d]))
    .filter((d) => named(d.field));
}

function conditionParts({ expected, actual }) {
  const before = expected ?? {};
  const after = actual ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((part) => JSON.stringify(before[part] ?? null) !== JSON.stringify(after[part] ?? null))
    .map((part) => ({ field: `conditions.${part}`, expected: before[part] ?? null, actual: after[part] ?? null }));
}

// `price_basis opak.`: a field and its value, a dash for none.
function value(field, v) {
  const shown = v === null || v === undefined ? dash : html`<code>${typeof v === 'string' ? v : JSON.stringify(v)}</code>`;
  return html`<div><span class="muted">${field}</span> ${shown}</div>`;
}
