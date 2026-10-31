// PROTOTYPE, throwaway: a promo run page, laid out as the backend's job
// summary (evals/promo_summary.py): heading, one table in total and by chain,
// per page, errors, warnings folded.
import { flowById } from '../flows.js';
import { formatCents, formatDate, formatSeconds, formatShare, shortModel } from '../format.js';
import { html } from '../html.js';
import { header } from '../layout.js';
import { renderNotFound } from '../not-found.js';
import { runFileOnGitHub } from '../runs.js';
import { summarisePromo } from './promo-summary.js';
import { chainName, dash, orDash, switcher } from './promo-common.js';

export function renderPromoRun({ flow: flowId, id, runFile }) {
  if (!runFile) return renderNotFound(`There is no eval run ${id}.`, flowId);
  const flow = flowById(flowId);
  const s = summarisePromo(`${id}.json`, runFile);
  const hasVerdicts = s.errors !== null;
  return String(html`${header(flow.id)}
<main class="run promo" style="--flow: ${flow.colour}">
  ${heading(flow, runFile, s)}
  ${hasVerdicts ? summary(s) : oldSummary(s)}
  ${perPage(runFile, hasVerdicts)}
  ${hasVerdicts ? html`${errors(promosOf(runFile, 'error'))}${warnings(promosOf(runFile, 'warning'))}` : html`<p class="muted">This run was scored before errors and warnings, so it lists no promos by verdict. Its missed and made-up promos are in the run file.</p>`}
  <p>${s.rescoredFrom ? html`Re-scored locally from <a href="${runFileOnGitHub(s.rescoredFrom)}">${s.rescoredFrom}</a>; not published.` : html`<a href="${runFileOnGitHub(id)}">Run file on GitHub</a>`}</p>
</main>
${switcher()}`);
}

function heading(flow, runFile, s) {
  return html`<div class="heading">
    <a class="back" href="#/${flow.id}">← All promo runs</a>
    <h1>Promo eval run, ${formatDate(runFile.date)}${s.rescoredFrom ? html` <span class="rescored">re-scored</span>` : ''}</h1>
    <div class="facts">
      <span>Prompt <strong>${runFile.config.version}</strong></span>
      ${Object.entries(s.configs).map(([chain, c]) => html`<span>${chainName(chain)} <strong>${shortModel(c.model)}</strong> · ${c.strategy}</span>`)}
      <span>Commit <a class="mono" href="https://github.com/no-market/backend/commit/${runFile.commit}">${runFile.commit.slice(0, 7)}</a></span>
    </div>
    <div class="pills">
      <span class="pill">Dataset <code>${runFile.dataset_revision}</code> · scorer <code>${runFile.scorer_version}</code></span>
      <span class="pill">${runFile.selection.length} of ${runFile.eligible.length} pages, ${runFile.full ? 'full' : 'not full'}</span>
      <span class="pill">Failed: ${s.failedPages} of ${s.pages} pages</span>
    </div>
  </div>`;
}

function columns(s) {
  return [{ name: 'Total', n: s }, ...Object.entries(s.byChain).map(([chain, n]) => ({ name: chainName(chain), n }))];
}

function table(s, rows, title) {
  const cols = columns(s);
  return html`<section class="block">
    <h2>${title}</h2>
    <div class="table-wrap">
      <table class="summary">
        <thead><tr><th></th>${cols.map((c, i) => html`<th class="${i === 0 ? 'total' : ''}">${c.name}</th>`)}</tr></thead>
        <tbody>${rows.map(([label, value]) => html`<tr><th scope="row">${label}</th>${cols.map((c, i) => html`<td class="${i === 0 ? 'total' : ''}">${value(c.n)}</td>`)}</tr>`)}</tbody>
      </table>
    </div>
  </section>`;
}

const of = (count, promos) => (count ? html`<strong>${count.count}</strong> <span class="muted">of ${promos} (${formatShare(count.share)})</span>` : dash);
const cents = (n) => (n.costUsd !== null ? formatCents(n.costUsd) : n.knownCostUsd ? html`≥ ${formatCents(n.knownCostUsd)}` : dash);

function summary(s) {
  return table(s, [
    ['Errors', (n) => of(n.errors, n.promos)],
    ['Warnings', (n) => of(n.warnings, n.promos)],
    ['Seconds per page, median (p95)', (n) => html`${orDash(n.seconds.median, formatSeconds)} <span class="muted">(${orDash(n.seconds.p95, formatSeconds)})</span>`],
    ['Cost per page', cents],
  ], 'Summary by chain');
}

function oldSummary(s) {
  return table(s, [
    ['Matched', (n) => html`<strong>${n.matched}</strong> <span class="muted">of ${n.truth}</span>`],
    ['Missed', (n) => n.missed],
    ['Made up', (n) => n.extra],
    ['Recall · precision', (n) => html`${orDash(n.recall, formatShare)} · ${orDash(n.precision, formatShare)}`],
    ['Seconds per page, median (p95)', (n) => html`${orDash(n.seconds.median, formatSeconds)} <span class="muted">(${orDash(n.seconds.p95, formatSeconds)})</span>`],
    ['Cost per page', cents],
  ], 'Summary by chain · scored before errors and warnings');
}

export function pageName(c) {
  return html`<span title="${c.id}">${chainName(c.chain)} p.${c.page}</span>${c.source_url ? html` · <a href="${c.source_url}">leaflet</a>` : ''}`;
}

function perPage(runFile, hasVerdicts) {
  const count = (c, v) => (c.promos ?? []).filter((p) => p.verdict === v).length;
  return html`<section class="block">
    <h2>Per page</h2>
    <div class="table-wrap">
      <table class="receipts">
        <thead><tr><th>Page</th><th>Promos</th>${hasVerdicts ? html`<th>Errors</th><th>Warnings</th>` : html`<th>Matched</th><th>Missed</th><th>Made up</th>`}<th>Seconds</th><th>Cost</th></tr></thead>
        <tbody>${runFile.cases.map((c) => html`
          <tr${c.failed ? html` class="failed"` : ''}><th scope="row">${pageName(c)}</th>
            <td>${hasVerdicts ? (c.unscored?.length ? html`<span class="muted" title="${c.unscored.join('; ')}">unscored</span>` : (c.promos ?? []).length) : c.truth_count}</td>
            ${hasVerdicts ? html`<td>${count(c, 'error')}</td><td>${count(c, 'warning')}</td>` : html`<td>${c.matched}</td><td>${c.missed.length}</td><td>${c.extra.length}</td>`}
            <td>${c.failed ? 'Failed' : formatSeconds(c.seconds)}</td><td>${orDash(c.usage?.cost_usd, formatCents)}</td></tr>`)}
        </tbody>
      </table>
    </div>
  </section>`;
}

export function promosOf(runFile, verdict) {
  return runFile.cases.flatMap((c) => (c.promos ?? []).filter((p) => p.verdict === verdict).map((p) => ({ c, p })));
}

function errors(rows) {
  return html`<section class="block">
    <h2>Errors <span class="muted">· ${rows.length}</span></h2>
    ${rows.length ? html`<div class="table-wrap">${promoTable(rows, 'error')}</div>` : html`<p>None.</p>`}
  </section>`;
}

function warnings(rows) {
  if (!rows.length) return '';
  return html`<details class="block-fold">
    <summary>Warnings · ${rows.length}</summary>
    <div class="table-wrap">${promoTable(rows, 'warning')}</div>
  </details>`;
}

function promoTable(rows, verdict) {
  return html`<table class="lines">
      <thead><tr><th>Page</th><th>Promo</th><th>Fields</th><th>Expected</th><th>Actual</th></tr></thead>
      <tbody>${rows.map(({ c, p }) => {
        const fields = verdict === 'error' ? p.errors : p.warnings;
        const [expected, actual] = values(c, p, fields);
        return html`<tr><td class="nowrap">${pageName(c)}</td><td>${p.name}</td><td class="mono">${fields.join(', ')}</td><td>${expected}</td><td>${actual}</td></tr>`;
      })}</tbody>
    </table>`;
}

// Each field's expected and actual value, as the job summary writes them.
export function values(c, p, fields) {
  if (p.prediction === null) {
    const price = c.expected[p.truth]?.fields?.price;
    return [price === null || price === undefined ? 'on the page' : html`price ${code(price)}`, html`${dash} <span class="muted">(missed)</span>`];
  }
  if (p.truth === null) {
    const price = c.predictions[p.prediction]?.price;
    return [html`${dash} <span class="muted">(not on the page)</span>`, price === null || price === undefined ? dash : html`price ${code(price)}`];
  }
  const wanted = new Set(fields);
  const expected = [];
  const actual = [];
  for (const d of c.differences) {
    if (d.prediction !== p.prediction) continue;
    const named = summaryFields(d).filter((f) => wanted.has(f));
    if (!named.length) continue;
    if (d.field === 'conditions') {
      // A null `conditions` against stated ones: only the parts that differ.
      for (const f of named) {
        const part = f.slice('conditions.'.length);
        expected.push(html`<div><span class="muted">${f}</span> ${code(d.expected?.[part] ?? null)}</div>`);
        actual.push(html`<div><span class="muted">${f}</span> ${code(d.actual?.[part] ?? null)}</div>`);
      }
      continue;
    }
    expected.push(html`<div><span class="muted">${d.field}</span> ${code(d.expected)}</div>`);
    actual.push(html`<div><span class="muted">${d.field}</span> ${code(d.actual)}</div>`);
  }
  return [expected, actual];
}

function summaryFields(d) {
  if (d.field === 'conditions') {
    const before = d.expected && typeof d.expected === 'object' ? d.expected : {};
    const after = d.actual && typeof d.actual === 'object' ? d.actual : {};
    const parts = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
      .map((k) => `conditions.${k}`);
    return parts.length ? parts : ['conditions'];
  }
  if (d.field.startsWith('conditions.')) return [d.field];
  return [d.field.split('.')[0]];
}

function code(value) {
  return html`<code>${typeof value === 'string' ? value : JSON.stringify(value)}</code>`;
}
