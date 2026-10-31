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
import { formatCents, formatDate, formatSeconds, shortModel } from './format.js';
import { dash, html, orDash } from './html.js';
import { header } from './layout.js';
import { hasVerdicts } from './eval-sets.js';
import { renderNotFound } from './not-found.js';
import { chainName, costCell, MATCHING_COLUMNS, pageLabel, promoRun, shareOf } from './promo-runs.js';
import { runFileOnGitHub } from './runs.js';

export function renderPromoRun({ flow: flowId, id, runFile }) {
  if (!runFile) return renderNotFound(`There is no eval run ${id}.`, flowId);
  const flow = flowById(flowId);
  const run = promoRun(runFile);
  const verdicts = hasVerdicts(run);
  return String(html`${header(flow.id)}
<main class="run promo" style="--flow: ${flow.colour}">
  ${heading(flow, run, runFile)}
  ${summary(run, verdicts)}
  ${perPage(runFile.cases, verdicts)}
  ${verdicts
    ? html`${errors(promosWith(runFile.cases, 'error'))}
  ${warnings(promosWith(runFile.cases, 'warning'))}`
    : html`<p class="muted">Scored before errors and warnings, so no promos are listed by verdict.</p>`}
  <p><a href="${runFileOnGitHub(id)}">Run file on GitHub</a></p>
</main>`);
}

// `run`, the run file as promoRun reads it; the selection and failed pages
// from the run file itself.
function heading(flow, run, runFile) {
  return html`<div class="heading">
    <a class="back" href="#/${flow.id}">← All promo runs</a>
    <h1>Promo eval run, ${formatDate(run.date)}</h1>
    <div class="facts">
      <span>Prompt <strong>${run.prompt}</strong></span>
      ${Object.entries(run.configs).map(
        ([chain, { model, strategy }]) => html`<span>${chainName(chain)} <strong>${shortModel(model)}</strong> · ${strategy}</span>`,
      )}
      <span>Commit <a class="mono" href="https://github.com/no-market/backend/commit/${run.commit}">${run.commit.slice(0, 7)}</a></span>
    </div>
    <div class="pills">
      <span class="pill">Dataset <code>${run.evalSet.dataset}</code> · scorer <code>${run.evalSet.scorer}</code></span>
      <span class="pill">${runFile.selection.length} of ${runFile.eligible.length} pages, ${runFile.full ? 'full' : 'not full'}</span>
      <span class="pill">Failed: ${run.totals.failedPages} of ${run.totals.pages} pages</span>
    </div>
  </div>`;
}

// The table of the run: a column for the total and one per chain, each over
// its own pages; with verdicts, errors and warnings, else matched, missed and
// made-up promos with recall and precision.
function summary(run, verdicts) {
  const columns = [
    { name: 'Total', numbers: run.totals },
    ...Object.entries(run.byChain).map(([chain, numbers]) => ({ name: chainName(chain), numbers })),
  ];
  const row = (label, value) => html`
        <tr><th scope="row">${label}</th>${columns.map(({ numbers }, i) => html`<td${i === 0 ? html` class="total"` : ''}>${value(numbers)}</td>`)}</tr>`;
  return html`<section aria-labelledby="summary-h" class="block">
    <h2 id="summary-h">Summary by chain</h2>
    <div class="table-wrap">
      <table class="summary">
        <thead><tr><th scope="col"></th>${columns.map(({ name }, i) => html`<th scope="col"${i === 0 ? html` class="total"` : ''}>${name}</th>`)}</tr></thead>
        <tbody>${[
          ...(verdicts
            ? [row('Errors', (n) => shareOf(n, 'errors')), row('Warnings', (n) => shareOf(n, 'warnings'))]
            : MATCHING_COLUMNS.map(([label, cell]) => row(label, cell))),
          row('Seconds per page, median (p95)', ({ seconds }) => html`${orDash(seconds.median, formatSeconds)} <span class="muted">(${orDash(seconds.p95, formatSeconds)})</span>`),
          row('Cost per page', costCell),
        ]}
        </tbody>
      </table>
    </div>
  </section>`;
}

// Each page's promos: with verdicts, how many are errors and warnings; else
// how many were matched, missed and made up.
const PAGE_COLUMNS = {
  verdicts: [
    ['Promos', (page) => html`${(page.promos ?? []).length}${unscored(page)}`],
    ['Errors', (page) => withVerdict(page, 'error')],
    ['Warnings', (page) => withVerdict(page, 'warning')],
  ],
  before: [
    ['Promos', (page) => page.truth_count],
    ['Matched', (page) => page.matched],
    ['Missed', (page) => page.missed.length],
    ['Made up', (page) => page.extra.length],
  ],
};
const withVerdict = (page, verdict) => (page.promos ?? []).filter((promo) => promo.verdict === verdict).length;
const unscored = (page) => (page.unscored?.length ? html` <span class="muted">· ${page.unscored.length} unscored</span>` : '');

function perPage(cases, verdicts) {
  const columns = PAGE_COLUMNS[verdicts ? 'verdicts' : 'before'];
  return html`<section aria-labelledby="pages-h" class="block">
    <h2 id="pages-h">Per page</h2>
    <div class="table-wrap">
      <table class="receipts">
        <thead><tr><th scope="col">Page</th>${columns.map(([name]) => html`<th scope="col">${name}</th>`)}<th scope="col">Seconds</th><th scope="col">Cost</th></tr></thead>
        <tbody>${cases.map((page) => pageRow(page, columns))}
        </tbody>
      </table>
    </div>
  </section>`;
}

function pageRow(page, columns) {
  const name = html`<th scope="row">${pageName(page)}</th>`;
  const spent = html`<td>${orDash(page.seconds, formatSeconds)}</td><td>${orDash(page.usage?.cost_usd, formatCents)}</td>`;
  if (page.failed) {
    return html`
          <tr class="failed">${name}<td colspan="${columns.length}"><strong>Failed:</strong> ${page.failure}</td>${spent}</tr>`;
  }
  return html`
          <tr>${name}${columns.map(([, cell]) => html`<td>${cell(page)}</td>`)}${spent}</tr>`;
}

// `Biedronka p. 4 · leaflet`, the page's id on hover and a link to its own
// leaflet: only a web address, never a leaflet file or page image.
function pageName(page) {
  const leaflet = /^https?:\/\//.test(page.source_url ?? '') ? html` · <a href="${page.source_url}">leaflet</a>` : '';
  return html`<span title="${page.id}">${pageLabel(page.chain, page.page)}</span>${leaflet}`;
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

// What was expected of a promo and what was read, as the backend's job
// summary gives them: a missed promo's price as expected, a made-up one's as
// read, each marked; else each difference under the `fields` named.
function expectedAndActual(page, promo, fields) {
  if (promo.prediction === null) {
    return [value('price', page.expected?.[promo.truth]?.fields?.price), html`${dash} <span class="muted">(missed)</span>`];
  }
  if (promo.truth === null) {
    return [html`${dash} <span class="muted">(not on the page)</span>`, value('price', page.predictions?.[promo.prediction]?.price, 'made up')];
  }
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

// `price_basis opak.`: a field and its value, a dash for none; `mark`, a
// muted note after it.
function value(field, v, mark = null) {
  const shown = orDash(v, (given) => html`<code>${typeof given === 'string' ? given : JSON.stringify(given)}</code>`);
  return html`<div><span class="muted">${field}</span> ${shown}${mark ? html` <span class="muted">(${mark})</span>` : ''}</div>`;
}
