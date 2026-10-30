// The comparison of two eval runs of one flow, at #/<flow>/compare/<a>/<b>:
// a heading, then its sections in order. A section is a function of the
// comparison (see `comparison`) to HTML; a later section is added to
// SECTIONS, reading what it needs from the comparison.
import { flowById } from './flows.js';
import { centsDifference, linesDifference, per100Difference, secondsDifference } from './differences.js';
import { formatCents, formatDate, formatPer100, formatSeconds, formatShare, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';

// The index entries of the two runs a compare address names, A the older:
// { a, b }, or { message } when a run is unknown or the runs are of
// different flows.
export function comparedRuns(route, index) {
  const find = (id) => index.runs.find((run) => run.run === id);
  for (const id of [route.a, route.b]) {
    if (!find(id)) return { message: `There is no run ${id} to compare.` };
  }
  const [a, b] = [find(route.a), find(route.b)];
  if (a.flow !== b.flow) {
    return {
      message: `The runs ${a.run} and ${b.run} are of different flows, ${a.flow} and ${b.flow}; only runs of one flow compare.`,
    };
  }
  if (a.flow !== route.flow) {
    return { message: `The runs ${a.run} and ${b.run} are ${a.flow} runs, not ${route.flow} runs.` };
  }
  return Date.parse(a.date) <= Date.parse(b.date) ? { a, b } : { a: b, b: a };
}

// What every section reads: the flow, runs A and B, each { id, run } with
// `run` the run file as it is, and the receipts of each and those shared by
// both, by name, in A's order.
export function comparison({ flow, a, b }) {
  const receiptsOf = (run) => run.cases.map((c) => c.receipt);
  const receipts = { a: receiptsOf(a.run), b: receiptsOf(b.run) };
  const inB = new Set(receipts.b);
  const shared = receipts.a.filter((receipt) => inB.has(receipt));
  return { flow: flowById(flow), a, b, receipts: { ...receipts, shared } };
}

// The summary by step, from each run file as it is (not recomputed over the
// shared receipts): a row per number, A, B and B − A for the total and each step.
function summary({ a, b }) {
  const columns = [
    { name: 'Total', of: (run) => run.numbers },
    ...STEPS.map(({ step, name }) => ({ name, of: (run) => run.numbers.steps.find((s) => s.step === step) })),
  ];
  return html`<section aria-labelledby="summary-h" class="summary">
    <div class="section-head">
      <h2 id="summary-h">Summary by step</h2>
      <span class="muted small"><span class="better">▼ better</span> · <span class="worse">▲ worse</span> · lower is better everywhere</span>
    </div>
    <div class="table-wrap">
      <table class="by-step">
        <thead>
          <tr>
            <th scope="col" rowspan="2"></th>
            ${columns.map((column, i) => html`<th scope="colgroup" colspan="3" class="group${i === 0 ? ' total' : ''}">${column.name}</th>`)}
          </tr>
          <tr>${columns.map((_, i) => html`<th scope="col" class="num${i === 0 ? ' total' : ''}">A</th><th scope="col" class="num${i === 0 ? ' total' : ''}">B</th><th scope="col" class="num${i === 0 ? ' total' : ''}">B − A</th>`)}</tr>
        </thead>
        <tbody>${SUMMARY_ROWS.map((row) => html`
          <tr>
            <th scope="row">${row.name}</th>${columns.map((column, i) => cells(row, column.of(a.run), column.of(b.run), i === 0))}
          </tr>`)}
        </tbody>
      </table>
    </div>
    <p class="muted small">Each difference reads B against A: lines and percentage points for errors and warnings, seconds and the change in per cent (×N when B takes at least twice as long), cents (¢) per receipt and dollars per 100 receipts for cost. Each run’s own numbers, over all its receipts.</p>
  </section>`;
}

const STEPS = [
  { step: 'read', name: 'Reading' },
  { step: 'choose_kinds', name: 'Kind choice' },
  { step: 'database', name: 'Database' },
];

// The summary's rows: the value of a total or a step's numbers, how it's
// written, and the difference of two values. A value of null (a cost the
// database step doesn't have) is written `—`, with no difference.
const SUMMARY_ROWS = [
  { name: 'Errors', value: (n) => n.errors, format: countAndShare, difference: linesDifference },
  { name: 'Warnings', value: (n) => n.warnings, format: countAndShare, difference: linesDifference },
  { name: 'Seconds, median', value: (n) => n.seconds.median_s, format: formatSeconds, difference: secondsDifference },
  { name: 'Seconds, p95', value: (n) => n.seconds.p95_s, format: formatSeconds, difference: secondsDifference },
  { name: 'Cost / receipt', value: (n) => n.cost_usd, format: formatCents, difference: centsDifference },
  { name: 'Cost / 100 receipts', value: (n) => n.cost_usd, format: formatPer100, difference: per100Difference },
];

function cells(row, aNumbers, bNumbers, isTotal) {
  const [a, b] = [aNumbers, bNumbers].map((numbers) => (numbers ? row.value(numbers) : null));
  const missing = a === null || a === undefined || b === null || b === undefined;
  const { mark, text } = missing ? { mark: 'same', text: '' } : row.difference(a, b);
  const total = isTotal ? ' total' : '';
  const written = (value) => (value === null || value === undefined ? '—' : row.format(value));
  return html`<td class="num${total}">${written(a)}</td><td class="num${total}">${written(b)}</td><td class="diff ${mark} num nowrap${total}">${text}</td>`;
}

// `13 (28.9%)`: a count of lines with its share of the run's lines.
function countAndShare({ count, share }) {
  return `${count} (${formatShare(share)})`;
}

// The sections of the comparison, in order, after its heading.
export const SECTIONS = [summary];

// The page of the comparison of runs `a` and `b`, each { id, run }, A the older.
export function renderCompare({ flow, a, b }) {
  const c = comparison({ flow, a, b });
  return String(html`${header(c.flow.id)}
<main class="compare" style="--flow: ${c.flow.colour}">
  ${heading(c)}
  ${SECTIONS.map((section) => section(c))}
</main>`);
}

function heading({ flow, a, b, receipts }) {
  const same = receipts.shared.length === receipts.a.length && receipts.shared.length === receipts.b.length;
  return html`<div class="compare-heading">
    <a class="back" href="#/${flow.id}">← All ${flow.name.toLowerCase()} runs</a>
    <h1>Comparing two eval runs</h1>
    <div class="run-cards">
      ${runCard(flow, 'A', 'older', a)}
      ${runCard(flow, 'B', 'newer', b)}
    </div>
    ${same
      ? html`<p class="muted">Both runs: the same ${receiptsCount(receipts.a.length)}.</p>`
      : html`<p class="receipts-differ">A: ${receiptsCount(receipts.a.length)} · B: ${receiptsCount(receipts.b.length)} · ${receipts.shared.length} shared. The summary is each run’s own.</p>`}
  </div>`;
}

function runCard(flow, letter, age, { id, run }) {
  const { receipts, failed, lines } = run.numbers;
  return html`<a class="run-card" href="#/${flow.id}/run/${id}">
        <span class="run-card-title"><span class="letter letter-${letter.toLowerCase()}">${letter}</span><strong>${formatDate(run.date)}</strong><span class="muted small">${age}</span></span>
        <span>${run.flow_version} · <span title="${run.steps.read.model}">${shortModel(run.steps.read.model)}</span> · <span title="${run.steps.choose_kinds.model}">${shortModel(run.steps.choose_kinds.model)}</span></span>
        <span class="muted small">commit <code>${run.commit.slice(0, 7)}</code> · ${receiptsCount(receipts)}${failed > 0 ? ` (${failed} failed)` : ''} · ${lines} lines</span>
      </a>`;
}

function receiptsCount(n) {
  return n === 1 ? '1 receipt' : `${n} receipts`;
}
