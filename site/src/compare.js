// The comparison of two eval runs of one flow, at #/<flow>/compare/<a>/<b>:
// a heading, then its sections in order. A section is a function of the
// comparison (see `comparison`) to HTML; a later section is added to
// SECTIONS, reading what it needs from the comparison.
import { flowById } from './flows.js';
import { centsDifference, linesDifference, per100Difference, secondsDifference } from './differences.js';
import { changedLines } from './changed-lines.js';
import { whyNotCompared as whyPromosNotCompared } from './eval-sets.js';
import { formatCents, formatDate, formatPer100, formatSeconds, formatShare, receiptName } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { runAddress } from './route.js';
import { dash, expected, recorded } from './run.js';
import { failed, modelPair, olderFirst, STEPS, stepName } from './runs.js';

// Why two runs of one flow (index entries, A the older) aren't compared, or
// null when they are, for a flow with a rule beyond being of one flow.
const WHY_NOT_COMPARED = { 'promo-extraction': whyPromosNotCompared };

// The index entries of the two runs a compare address names, A the older:
// { a, b }, or { message } when a run is unknown, the runs are of different
// flows, or their flow doesn't compare them (see WHY_NOT_COMPARED).
export function comparedRuns(route, index) {
  const find = (id) => index.runs.find((entry) => entry.run === id);
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
  const [older, newer] = olderFirst(a, b);
  const message = WHY_NOT_COMPARED[a.flow]?.(older, newer);
  if (message) return { message };
  return { a: older, b: newer };
}

// What every section reads: the flow, runs A and B, each { id, run } with
// `run` the run file as it is, and the receipts of each and those shared by
// both, by name, in A's order, with `same` when both runs have the same ones.
function comparison({ flow, a, b }) {
  const receiptsOf = (runFile) => runFile.cases.map((c) => c.receipt);
  const receipts = { a: receiptsOf(a.run), b: receiptsOf(b.run) };
  const inB = new Set(receipts.b);
  const shared = receipts.a.filter((receipt) => inB.has(receipt));
  const same = shared.length === receipts.a.length && shared.length === receipts.b.length;
  return { flow: flowById(flow), a, b, receipts: { ...receipts, shared, same } };
}

// The summary by step, from each run file as it is (not recomputed over the
// shared receipts): a row per number, A, B and B − A for the total and each step.
function summary({ a, b }) {
  const columns = [
    { name: 'Total', of: (runFile) => runFile.numbers },
    ...STEPS.map(({ step, title }) => ({ name: title, of: (runFile) => runFile.numbers.steps.find((s) => s.step === step) })),
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
  return html`<td class="num${total}">${written(a)}</td><td class="num${total}">${written(b)}</td><td class="diff ${mark} num${total}">${wrappable(text)}</td>`;
}

// A difference that may break onto a second line only at its ` · `, so a
// narrow column shows `▲ +25 lines` over `· +61.8 pts`, never a split number.
function wrappable(text) {
  return text.split(' · ').map((part, i) => html`${i > 0 ? ' · ' : ''}<span class="nowrap">${part}</span>`);
}

// `13 (28.9%)`: a count of lines with its share of the run's lines.
function countAndShare({ count, share }) {
  return `${count} (${formatShare(share)})`;
}

// The lines whose verdict changed, over the shared receipts: worse in B, then
// better, then read in one run only, each in receipt and line order (see
// `changedLines`).
function changed({ a, b, receipts }) {
  const { worse, better, oneRunOnly } = changedLines(a.run, b.run);
  const count = worse.length + better.length + oneRunOnly.length;
  const group = (mark, title, lines) =>
    lines.length === 0
      ? ''
      : html`
        <tbody class="${mark}">
          <tr class="group"><th scope="colgroup" colspan="7">${title} · ${linesCount(lines.length)}</th></tr>${lines.map(changedRow)}
        </tbody>`;
  return html`<section aria-labelledby="changed-h" class="changed">
    <h2 id="changed-h">Lines whose verdict changed <span class="muted">· ${count} on ${receiptsCount(receipts.shared.length, receipts.same ? '' : 'shared ')}</span></h2>
    ${count === 0
      ? html`<p class="muted">No line’s verdict changed.</p>`
      : html`<div class="table-wrap">
      <table class="lines changed-lines">
        <thead><tr><th scope="col">Receipt</th><th scope="col">As printed</th><th scope="col">A</th><th scope="col">B</th><th scope="col">A recorded</th><th scope="col">B recorded</th><th scope="col">Expected</th></tr></thead>${group('worse', '▲ Worse in B', worse)}${group('better', '▼ Better in B', better)}${group('one-run-only', 'Read in one run only', oneRunOnly)}
      </table>
    </div>`}
  </section>`;
}

function changedRow({ receipt, a, b }) {
  const line = b ?? a;
  const printed = line.text ?? html`<span class="muted">read:</span> ${line.read?.text ?? ''}`;
  return html`
          <tr><td class="nowrap" title="${receipt}">${receiptName(receipt)}</td><td class="mono">${printed}</td><td class="nowrap">${verdict(a)}</td><td class="nowrap">${verdict(b)}</td><td>${a ? recorded(a.recorded) : dash}</td><td>${b ? recorded(b.recorded) : dash}</td><td>${expected(line)}</td></tr>`;
}

// A line's verdict and, for an error or a warning, its step: `error · reading`;
// `not read` for a run the line isn't in.
function verdict(line) {
  if (!line) return html`<span class="verdict not-read">not read</span>`;
  const step = line.step ? ` · ${stepName(line.step)}` : '';
  return html`<span class="verdict ${line.verdict}">${line.verdict}${step}</span>`;
}

function linesCount(n) {
  return n === 1 ? '1 line' : `${n} lines`;
}

// Per receipt, folded: a row per shared receipt, from each run's numbers for
// it as they are.
function perReceipt({ a, b, receipts }) {
  const caseOf = (runFile, receipt) => runFile.cases.find((c) => c.receipt === receipt);
  const groups = RECEIPT_COLUMNS.map((column) => html`<th scope="colgroup" colspan="3" class="group">${column.name}</th>`);
  const letterHeads = RECEIPT_COLUMNS.map(() => html`<th scope="col" class="num">A</th><th scope="col" class="num">B</th><th scope="col" class="num">B − A</th>`);
  return html`<details class="block-fold per-receipt">
    <summary>Per receipt <span class="muted">· ${receiptsCount(receipts.shared.length)} in both runs</span></summary>
    <div class="table-wrap">
      <table class="by-receipt">
        <thead>
          <tr><th scope="col" rowspan="2">Receipt</th><th scope="col" rowspan="2" class="num">Lines A · B</th>${groups}</tr>
          <tr>${letterHeads}</tr>
        </thead>
        <tbody>${receipts.shared.map((receipt) => receiptRow(receipt, caseOf(a.run, receipt), caseOf(b.run, receipt)))}
        </tbody>
      </table>
    </div>
    ${onlyIn('A', receipts.a, receipts.shared)}${onlyIn('B', receipts.b, receipts.shared)}
  </details>`;
}

// `Only in A: Kaufland, 1 Oct 2026.`: the receipts of one run the other lacks.
function onlyIn(letter, ofRun, shared) {
  const only = ofRun.filter((receipt) => !shared.includes(receipt));
  if (only.length === 0) return '';
  return html`<p class="only-in muted small">Only in ${letter}: ${only.map((receipt, i) => html`${i > 0 ? ' · ' : ''}<span title="${receipt}">${receiptName(receipt)}</span>`)}.</p>`;
}

// The per receipt columns: a receipt's value, how it's written, and the
// difference of two values.
const RECEIPT_COLUMNS = [
  { name: 'Errors', value: (n) => n.errors, format: ({ count }) => String(count), difference: linesDifference },
  { name: 'Warnings', value: (n) => n.warnings, format: ({ count }) => String(count), difference: linesDifference },
  { name: 'Seconds', value: (n) => n.seconds, format: formatSeconds, difference: secondsDifference },
  { name: 'Cost', value: (n) => n.cost_usd, format: formatCents, difference: centsDifference },
];

// A shared receipt's row. A run in which the receipt failed has no numbers
// for it: its cells are `—`, with no difference, and the receipt is marked
// failed in that run, the error in the mark's title.
function receiptRow(receipt, inA, inB) {
  const numbers = [inA, inB].map((c) => (failed(c) ? null : c.numbers));
  const failures = [['A', inA], ['B', inB]].filter(([, c]) => failed(c));
  const mark = failures.length === 0
    ? ''
    : html` <span class="failed-mark" title="${failures.map(([letter, c]) => `${letter}: ${c.error}`).join('\n')}">failed in ${failures.map(([letter]) => letter).join(' and ')}</span>`;
  const lines = numbers.map((n) => (n ? n.lines : '—')).join(' · ');
  return html`
          <tr${failures.length > 0 ? html` class="failed"` : ''}><th scope="row" title="${receipt}">${receiptName(receipt)}${mark}</th><td class="num">${lines}</td>${RECEIPT_COLUMNS.map((column) => cells(column, numbers[0], numbers[1], false))}</tr>`;
}

// The sections of the comparison, in order, after its heading.
const SECTIONS = [summary, changed, perReceipt];

// The page of the comparison of runs `a` and `b`, each { id, run }, A the older.
export function renderCompare({ flow, a, b }) {
  const c = comparison({ flow, a, b });
  return String(html`${header(c.flow.id)}
<main class="compare" style="--flow: ${c.flow.colour}">
  ${heading(c)}
  ${SECTIONS.map((section) => section(c))}
</main>`);
}

// The heading: runs A and B, and when their receipts differ, how many each
// has and how many are shared, which the changed lines and per receipt cover.
function heading({ flow, a, b, receipts }) {
  return html`<div class="compare-heading">
    <a class="back" href="#/${flow.id}">← All ${flow.name.toLowerCase()} runs</a>
    <h1>Comparing two eval runs</h1>
    <div class="run-cards">
      ${runCard(flow, 'A', 'older', a)}
      ${runCard(flow, 'B', 'newer', b)}
    </div>
    ${receipts.same
      ? ''
      : html`<p class="receipts-differ">A: ${receiptsCount(receipts.a.length)} · B: ${receiptsCount(receipts.b.length)} · ${receipts.shared.length} shared. The summary is each run’s own; changed lines and per receipt cover the ${receiptsCount(receipts.shared.length, 'shared ')}.</p>`}
  </div>`;
}

function runCard(flow, letter, age, { id, run: runFile }) {
  const { receipts, failed: failedCount, lines } = runFile.numbers;
  const { read, choose_kinds: chooseKinds } = runFile.steps;
  return html`<a class="run-card" href="${runAddress(flow.id, id)}">
        <span class="run-card-title"><span class="letter letter-${letter.toLowerCase()}">${letter}</span><strong>${formatDate(runFile.date)}</strong><span class="muted small">${age}</span></span>
        <span>${runFile.flow_version} · <span title="${read.model} · ${chooseKinds.model}">${modelPair(read.model, chooseKinds.model)}</span></span>
        <span class="muted small">commit <code>${runFile.commit.slice(0, 7)}</code> · ${receiptsCount(receipts)}${failedCount > 0 ? ` (${failedCount} failed)` : ''} · ${lines} lines</span>
      </a>`;
}

// `3 receipts`, `1 shared receipt`.
function receiptsCount(n, kind = '') {
  return n === 1 ? `1 ${kind}receipt` : `${n} ${kind}receipts`;
}
