// PROTOTYPE, throwaway: the comparison of two promo runs. Variants A and B
// don't offer it across eval sets; C compares them with a mark.
import { flowById } from '../flows.js';
import { formatDate, formatShare } from '../format.js';
import { html } from '../html.js';
import { header } from '../layout.js';
import { renderNotFound } from '../not-found.js';
import { runAddress } from '../route.js';
import { summarisePromo } from './promo-summary.js';
import { pageName } from './promo-run.js';
import {
  centsDifference, chainName, costPerPage, dash, modelsLine, promosDifference, secondsDifference,
  secondsPerPage, switcher, variant,
} from './promo-common.js';

export function renderPromoCompare({ flow: flowId, a, b }) {
  const flow = flowById(flowId);
  const sa = summarisePromo(`${a.id}.json`, a.run);
  const sb = summarisePromo(`${b.id}.json`, b.run);
  if (!sa.errors || !sb.errors) {
    return renderNotFound('A run scored before errors and warnings has no verdicts to compare.', flowId);
  }
  const crossSet = sa.evalSet.key !== sb.evalSet.key;
  if (crossSet && variant !== 'C') {
    return renderNotFound(`These runs are on different eval sets (${sa.evalSet.label}; ${sb.evalSet.label}), so they are not compared.`, flowId);
  }
  return String(html`${header(flow.id)}
<main class="compare promo" style="--flow: ${flow.colour}">
  <div class="compare-heading">
    <a class="back" href="#/${flow.id}">← All promo runs</a>
    <h1>Comparing two promo runs</h1>
    <div class="run-cards">${card('A', sa)}${card('B', sb)}</div>
    ${crossSet ? html`<p class="receipts-differ"><strong>Different eval sets.</strong> A is scored with <code>${sa.evalSet.scorer}</code> on ${sa.evalSet.pages} pages, B with <code>${sb.evalSet.scorer}</code> on ${sb.evalSet.pages} pages. The summary is each run's own; a promo's change of verdict may come from the scorer, not the model. Only pages in both are listed.</p>` : ''}
  </div>
  ${summary(sa, sb)}
  ${changed(a.run, b.run)}
</main>
${switcher()}`);
}

function card(letter, s) {
  return html`<a class="run-card" href="${runAddress('promo-extraction', s.run)}">
      <span class="run-card-title"><span class="letter${letter === 'B' ? ' letter-b' : ''}">${letter}</span><strong>${formatDate(s.date)}</strong>${s.rescoredFrom ? html` <span class="rescored">re-scored</span>` : ''}</span>
      <span>${modelsLine(s)}</span>
      <span class="muted small">${s.evalSet.label}</span>
    </a>`;
}

function summary(sa, sb) {
  const chains = [...new Set([...Object.keys(sa.byChain), ...Object.keys(sb.byChain)])].sort();
  const cols = [{ name: 'Total', of: (s) => s }, ...chains.map((c) => ({ name: chainName(c), of: (s) => s.byChain[c] ?? null }))];
  const rows = [
    { name: 'Errors', value: (n) => share(n.errors), diff: (x, y) => promosDifference(x.errors, y.errors) },
    { name: 'Warnings', value: (n) => share(n.warnings), diff: (x, y) => promosDifference(x.warnings, y.warnings) },
    { name: 's / page, median', value: secondsPerPage, diff: (x, y) => secondsDifference(x.seconds.median, y.seconds.median) },
    { name: 'Cost / page', value: costPerPage, diff: (x, y) => centsDifference(x.costUsd, y.costUsd) },
  ];
  return html`<section>
    <div class="section-head"><h2>Summary by chain</h2><span class="muted small"><span class="better">▼ better</span> · <span class="worse">▲ worse</span> · lower is better everywhere</span></div>
    <div class="table-wrap">
      <table class="by-step">
        <thead>
          <tr><th rowspan="2"></th>${cols.map((c, i) => html`<th colspan="3" class="group${i === 0 ? ' total' : ''}">${c.name}</th>`)}</tr>
          <tr>${cols.map((_, i) => html`<th class="num${i === 0 ? ' total' : ''}">A</th><th class="num${i === 0 ? ' total' : ''}">B</th><th class="num${i === 0 ? ' total' : ''}">B − A</th>`)}</tr>
        </thead>
        <tbody>${rows.map((row) => html`<tr><th scope="row">${row.name}</th>${cols.map((c, i) => {
          const x = c.of(sa);
          const y = c.of(sb);
          const d = x && y ? row.diff(x, y) : null;
          const t = i === 0 ? ' total' : '';
          return html`<td class="num nowrap${t}">${x ? row.value(x) : dash}</td><td class="num nowrap${t}">${y ? row.value(y) : dash}</td><td class="num nowrap diff${t} ${d ? d.mark : ''}">${d ? d.text.split(' · ').map((part, k) => html`${k ? html`<br>` : ''}${part}`) : dash}</td>`;
        })}</tr>`)}</tbody>
      </table>
    </div>
    <p class="muted small">Errors and warnings in promos and percentage points; seconds per page; cents per page. Each run's own numbers, over all its pages.</p>
  </section>`;
}

const share = (count) => (count ? html`${count.count} <span class="muted">(${formatShare(count.share)})</span>` : dash);

const RANK = { none: 0, right: 0, warning: 1, error: 2 };
const norm = (name) => name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Every promo of the pages in both runs, by page and truth (a made-up promo
// by its name), with its verdict in A and in B.
function changed(ra, rb) {
  const pagesB = new Map(rb.cases.map((c) => [c.id, c]));
  const rows = [];
  for (const ca of ra.cases) {
    const cb = pagesB.get(ca.id);
    if (!cb) continue;
    const byKey = new Map();
    const key = (p) => (p.truth ?? `extra:${norm(p.name)}`);
    for (const p of ca.promos ?? []) byKey.set(key(p), { page: ca, a: p, b: null });
    for (const p of cb.promos ?? []) {
      const row = byKey.get(key(p)) ?? { page: cb, a: null, b: null };
      row.b = p;
      byKey.set(key(p), row);
    }
    rows.push(...byKey.values());
  }
  const verdictOf = (p) => (p ? p.verdict : 'none');
  const fieldsOf = (p) => (p ? [...p.errors, ...p.warnings].join(', ') : '');
  const worse = rows.filter((r) => RANK[verdictOf(r.b)] > RANK[verdictOf(r.a)]);
  const better = rows.filter((r) => RANK[verdictOf(r.b)] < RANK[verdictOf(r.a)]);
  const otherFields = rows.filter((r) => RANK[verdictOf(r.b)] === RANK[verdictOf(r.a)] && fieldsOf(r.a) !== fieldsOf(r.b));
  const same = rows.length - worse.length - better.length - otherFields.length;
  const onlyA = ra.cases.filter((c) => !pagesB.has(c.id)).length;
  const onlyB = rb.cases.filter((c) => !ra.cases.some((x) => x.id === c.id)).length;
  return html`<section>
    <div class="section-head"><h2>Promos whose verdict changed <span class="muted">· ${worse.length + better.length}</span></h2><span class="muted small">${same} promos unchanged${onlyA || onlyB ? ` · pages only in A: ${onlyA}, only in B: ${onlyB}` : ''}</span></div>
    <div class="table-wrap">
      <table class="changed-lines">
        <thead><tr><th>Page</th><th>Promo</th><th>A</th><th>B</th></tr></thead>
        ${group('worse', `Worse in B · ${worse.length}`, worse)}
        ${group('better', `Better in B · ${better.length}`, better)}
        ${group('one-run-only', `Same verdict, other fields · ${otherFields.length}`, otherFields)}
      </table>
    </div>
    <p class="muted small">A made-up promo is an error; one no longer made up counts as better. Promos are matched by their reviewed promo, a made-up one by its name.</p>
  </section>`;
}

function group(kind, title, rows) {
  if (!rows.length) return '';
  return html`<tbody class="${kind}"><tr class="group"><th colspan="4">${title}</th></tr>${rows.map((r) => html`<tr><td class="nowrap">${pageName(r.page)}</td><td>${(r.b ?? r.a).name}</td><td>${verdict(r.a)}</td><td>${verdict(r.b)}</td></tr>`)}</tbody>`;
}

function verdict(p) {
  if (!p) return html`<span class="verdict">none</span>`;
  const fields = [...p.errors.map((f) => html`<strong>${f}</strong>`), ...p.warnings.map((f) => html`${f}`)];
  return html`<span class="verdict ${p.verdict}">${p.verdict}</span> <span class="small">${fields.map((f, i) => html`${i ? ', ' : ''}${f}`)}</span>`;
}
