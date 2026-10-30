import { flowById } from './flows.js';
import { formatCents, formatDate, formatSeconds, formatShare, receiptName } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { renderNotFound } from './not-found.js';
import { failed, runFileOnGitHub, STEPS, stepName } from './runs.js';

// A run page: the eval run `id` (its file name without `.json`), from its
// `runFile`, laid out as the job summary of Evals V2. With no `runFile`, as
// for a run that doesn't exist, a message saying so.
export function renderRun({ flow: flowId, id, runFile }) {
  if (!runFile) return renderNotFound(`There is no eval run ${id}.`, flowId);
  const flow = flowById(flowId);
  return String(html`${header(flow.id)}
<main class="run" style="--flow: ${flow.colour}">
  ${heading(flow, runFile)}
  ${summary(runFile.numbers)}
  ${perReceipt(runFile.cases)}
  ${errors(linesOf(runFile.cases, 'error'))}
  ${warnings(linesOf(runFile.cases, 'warning'))}
  <p><a href="${runFileOnGitHub(id)}">Run file on GitHub</a></p>
</main>`);
}

export const dash = html`<span class="muted">—</span>`;

// A number that may be missing (a step with no priced calls, a run whose every
// receipt failed) as `—`.
const orDash = (value, format) => (value === null || value === undefined ? dash : format(value));
const stepOf = (numbers, step) => numbers.steps.find((s) => s.step === step);

function heading(flow, runFile) {
  const { numbers } = runFile;
  return html`<div class="heading">
    <a class="back" href="#/${flow.id}">← All ${flow.name.toLowerCase()} runs</a>
    <h1>Eval run, ${formatDate(runFile.date)}</h1>
    <div class="facts">
      <span>Flow <strong>${runFile.flow_version}</strong></span>
      <span>Reading <strong>${runFile.steps.read.model}</strong></span>
      <span>Kind choice <strong>${runFile.steps.choose_kinds.model}</strong></span>
      <span>Commit <a class="mono" href="https://github.com/no-market/backend/commit/${runFile.commit}">${runFile.commit.slice(0, 7)}</a></span>
    </div>
    <div class="pills">
      <span class="pill">${numbers.receipts} receipts · ${numbers.lines} lines</span>
      <span class="pill">Failed: ${numbers.failed} of ${numbers.receipts} receipts</span>
    </div>
  </div>`;
}

function summary(numbers) {
  const steps = STEPS.map(({ step }) => stepOf(numbers, step));
  const row = (label, total, perStep) => html`
        <tr><th scope="row">${label}</th><td class="total">${total}</td>${steps.map((s) => html`<td>${s ? perStep(s) : dash}</td>`)}</tr>`;
  const count = ({ count, share }) => html`<strong>${count}</strong> <span class="muted">(${orDash(share, formatShare)})</span>`;
  return html`<section aria-labelledby="summary-h" class="block">
    <h2 id="summary-h">Summary by step</h2>
    <div class="table-wrap">
      <table class="summary">
        <thead><tr><th scope="col"></th><th scope="col" class="total">Total</th>${STEPS.map(({ title }) => html`<th scope="col">${title}</th>`)}</tr></thead>
        <tbody>${[
          row('Errors', count(numbers.errors), (s) => s.errors.count),
          row('Warnings', count(numbers.warnings), (s) => s.warnings.count),
          row('Seconds / receipt, median', html`<strong>${orDash(numbers.seconds.median_s, formatSeconds)}</strong>`, (s) => orDash(s.seconds.median_s, formatSeconds)),
          row('Seconds / receipt, p95', orDash(numbers.seconds.p95_s, formatSeconds), (s) => orDash(s.seconds.p95_s, formatSeconds)),
          row('Cost / receipt', html`<strong>${orDash(numbers.cost_usd, formatCents)}</strong>`, (s) => orDash(s.cost_usd, formatCents)),
        ]}
        </tbody>
      </table>
    </div>
  </section>`;
}

function perReceipt(cases) {
  return html`<section aria-labelledby="receipts-h" class="block">
    <h2 id="receipts-h">Per receipt</h2>
    <div class="table-wrap">
      <table class="receipts">
        <thead><tr><th scope="col">Receipt</th><th scope="col">Lines</th><th scope="col">Errors R · K · D</th><th scope="col">Warnings R · K · D</th><th scope="col">Seconds R · K · D</th><th scope="col">Cost</th></tr></thead>
        <tbody>${cases.map(receiptRow)}
        </tbody>
      </table>
    </div>
    <p class="muted small">R reading · K kind choice · D database</p>
  </section>`;
}

function receiptRow(receiptCase) {
  const name = html`<th scope="row" title="${receiptCase.receipt}">${receiptName(receiptCase.receipt)}</th>`;
  if (failed(receiptCase)) {
    return html`
          <tr class="failed">${name}<td colspan="5"><strong>Failed:</strong> ${receiptCase.error}</td></tr>`;
  }
  const { numbers } = receiptCase;
  const byStep = (value) => STEPS.map(({ step }) => {
    const s = stepOf(numbers, step);
    return s ? value(s) : '—';
  }).join(' · ');
  return html`
          <tr>${name}<td>${numbers.lines}</td><td>${byStep((s) => s.errors.count)}</td><td>${byStep((s) => s.warnings.count)}</td><td>${byStep((s) => (s.seconds === null ? '—' : s.seconds.toFixed(1)))}</td><td>${orDash(numbers.cost_usd, formatCents)}</td></tr>`;
}

// Why a purchase was lost: what the flow recorded instead of a kind.
const LOST = { no_result: 'no answer', unknown: 'unknown', noise: 'noise' };

// The lines with the verdict, in receipt and line order, each with its receipt.
function linesOf(cases, verdict) {
  return cases.flatMap((receiptCase) =>
    receiptCase.lines.filter((line) => line.verdict === verdict).map((line) => ({ receipt: receiptCase.receipt, line })),
  );
}

function errors(lines) {
  return html`<section aria-labelledby="errors-h" class="block">
    <h2 id="errors-h">Errors <span class="muted">· ${lines.length}</span></h2>
    <div class="table-wrap">${linesTable(lines)}</div>
  </section>`;
}

function linesTable(lines) {
  return html`
      <table class="lines">
        <thead><tr><th scope="col">Receipt</th><th scope="col">Step</th><th scope="col">As printed</th><th scope="col">As read</th><th scope="col">Recorded</th><th scope="col">Expected</th></tr></thead>
        <tbody>${lines.map(lineRow)}
        </tbody>
      </table>`;
}

function lineRow({ receipt, line }) {
  return html`
          <tr><td class="nowrap" title="${receipt}">${receiptName(receipt)}</td><td class="nowrap">${line.step ? stepName(line.step) : dash}</td><td class="mono">${line.text ?? dash}</td><td class="mono">${asRead(line)}</td><td>${recorded(line.recorded)}</td><td>${expected(line)}</td></tr>`;
}

// The line as read, with each detail other than its text that was read
// otherwise than printed: `… · discounts none, printed -5.80`.
function asRead(line) {
  if (line.read === null) return dash;
  const details = (line.misread ?? [])
    .filter((m) => m.detail !== 'text')
    .map((m) => ` · ${m.detail.replace('_', ' ')} ${m.read}, printed ${m.printed}`);
  return html`${line.read.text}<span class="muted">${details}</span>`;
}

// A kind, a new kind marked as new, or a dash with the reason no kind was recorded.
export function recorded(record) {
  if (record === null) return html`${dash} <span class="muted">(not read)</span>`;
  if (record.outcome === 'existing') return record.kind;
  if (record.outcome === 'new') return html`<span class="new">new</span>: ${record.kind}`;
  return html`${dash} <span class="muted">(${LOST[record.outcome] ?? record.outcome})</span>`;
}

// The truth: a kind, a new kind marked as new, or a dash with the outcome
// expected instead of a kind (noise, unknown). An extra line has none.
export function expected(line) {
  if (line.expected === 'new') return html`<span class="new">new</span>: ${line.label?.name}`;
  if (line.expected === 'noise' || line.expected === 'unknown') {
    return html`${dash} <span class="muted">(${line.expected})</span>`;
  }
  return line.label?.name ?? dash;
}

// The warnings, folded, with the steps they come from in the summary line.
function warnings(lines) {
  const steps = [...new Set(lines.map(({ line }) => line.step))];
  const bySteps = steps.length === 1
    ? `all ${stepName(steps[0])}`
    : steps.map((step) => `${stepName(step)} ${lines.filter(({ line }) => line.step === step).length}`).join(' · ');
  return html`<details class="block-fold">
    <summary>Warnings · ${lines.length}${lines.length > 0 ? html` <span class="muted">(${bySteps})</span>` : ''}</summary>
    <div class="table-wrap">${linesTable(lines)}</div>
  </details>`;
}
