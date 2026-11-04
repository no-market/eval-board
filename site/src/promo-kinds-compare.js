// The comparison of two promo kinds runs of one eval set, at
// #/promo-kinds/compare/<a>/<b> (comparedRuns refuses any other pair): a
// heading with two run cards, the numbers in total and by group, then the
// promos that changed verdict. Promos pair by `id`.
import { promosDifference, secondsDifference } from './differences.js';
import { evalSetName } from './eval-sets.js';
import { flowById } from './flows.js';
import { formatDate, formatSeconds, promosCount, shortModel } from './format.js';
import { html } from './html.js';
import { header } from './layout.js';
import { badness } from './promo-changes.js';
import { cells, promoVerdict } from './promo-compare.js';
import { answeredKinds, costCell, costDifference, expectedKinds, promoCell, promoKindsRun } from './promo-kinds-runs.js';
import { shareOf } from './promo-runs.js';
import { runAddress } from './route.js';

// The page of the comparison of runs `a` and `b`, each { id, run }, A the older.
export function renderPromoKindsCompare({ flow: flowId, a, b }) {
  const flow = flowById(flowId);
  const [runA, runB] = [a, b].map(({ id, run }) => ({ id, file: run, read: promoKindsRun(run) }));
  return String(html`${header(flow.id)}
<main class="compare" style="--flow: ${flow.colour}">
  ${heading(flow, runA, runB)}
  ${summary(runA.read, runB.read)}
  ${changed(runA.file, runB.file)}
</main>`);
}

function heading(flow, a, b) {
  return html`<div class="compare-heading">
    <a class="back" href="#/${flow.id}">← All promo kinds runs</a>
    <h1>Comparing two eval runs</h1>
    <p class="muted">Both on the eval set <strong>${evalSetName(a.read.evalSet)}</strong></p>
    <div class="run-cards">
      ${runCard(flow, 'A', 'older', a)}
      ${runCard(flow, 'B', 'newer', b)}
    </div>
  </div>`;
}

function runCard(flow, letter, age, { id, read: run }) {
  const { failed, promos } = run.totals;
  return html`<a class="run-card" href="${runAddress(flow.id, id)}">
        <span class="run-card-title"><span class="letter letter-${letter.toLowerCase()}">${letter}</span><strong>${formatDate(run.date)}</strong><span class="muted small">${age}</span></span>
        <span>${run.prompt} · ${shortModel(run.model)}</span>
        <span class="muted small">commit <code>${run.commit.slice(0, 7)}</code> · ${promosCount(promos)}${failed > 0 ? ` (${failed} failed)` : ''}</span>
      </a>`;
}

// The numbers: how each is written, and the difference of two, or null for none.
const NUMBERS = [
  { name: 'Errors', format: (n) => shareOf(n), difference: (a, b) => promosDifference(a.errors, b.errors) },
  { name: 'Warnings', format: (n) => shareOf(n, 'warnings'), difference: (a, b) => promosDifference(a.warnings, b.warnings) },
  { name: 's / promo, median', format: (n) => formatSeconds(n.seconds.median), difference: (a, b) => secondsDifference(a.seconds.median, b.seconds.median) },
  { name: 'Cost / promo', format: costCell, difference: costDifference },
];

// A row for the total and each group of either run, in alphabetical order,
// from each run's own numbers: A, B and B − A for every number. A group one
// run lacks is `—`.
function summary(a, b) {
  const groups = [...new Set([...Object.keys(a.byGroup), ...Object.keys(b.byGroup)])].sort();
  const row = (name, numbersA, numbersB, total) => html`
          <tr>
            <th scope="row"${total ? html` class="total"` : ''}>${name}</th>${NUMBERS.map((number) => cells(number, numbersA, numbersB, total))}
          </tr>`;
  return html`<section aria-labelledby="summary-h" class="summary">
    <div class="section-head">
      <h2 id="summary-h">Summary by group</h2>
      <span class="muted small"><span class="better">▼ better</span> · <span class="worse">▲ worse</span> · lower is better everywhere</span>
    </div>
    <div class="table-wrap">
      <table class="by-step">
        <thead>
          <tr>
            <th scope="col" rowspan="2"></th>
            ${NUMBERS.map(({ name }) => html`<th scope="colgroup" colspan="3" class="group">${name}</th>`)}
          </tr>
          <tr>${NUMBERS.map(() => html`<th scope="col" class="num">A</th><th scope="col" class="num">B</th><th scope="col" class="num">B − A</th>`)}</tr>
        </thead>
        <tbody>${row('Total', a.totals, b.totals, ' total')}${groups.map((group) => row(group, a.byGroup[group], b.byGroup[group], ''))}
        </tbody>
      </table>
    </div>
    <p class="muted small">Each difference reads B against A: promos and percentage points for errors and warnings, counted in promos; seconds and the change in per cent (×N when B takes at least twice as long) for the median seconds per promo; cents (¢) per promo for cost, ≥ the priced part, with no difference, when some calls weren’t priced. Each run’s own numbers.</p>
  </section>`;
}

// The promos of A that B also has, worse then better in B by their verdicts,
// in A's order, each counted, and how many are unchanged.
function changed(a, b) {
  const inB = new Map(b.cases.map((promo) => [promo.id, promo]));
  const pairs = a.cases.filter((promo) => inB.has(promo.id)).map((promo) => ({ a: promo, b: inB.get(promo.id) }));
  const worse = pairs.filter((pair) => badness(pair.b) > badness(pair.a));
  const better = pairs.filter((pair) => badness(pair.b) < badness(pair.a));
  const unchanged = pairs.length - worse.length - better.length;
  const group = (mark, title, found) =>
    found.length === 0
      ? ''
      : html`
        <tbody class="${mark}">
          <tr class="group"><th scope="colgroup" colspan="4">${title} · ${promosCount(found.length)}</th></tr>${found.map(changedRow)}
        </tbody>`;
  return html`<section aria-labelledby="changed-h" class="changed">
    <div class="section-head">
      <h2 id="changed-h">Changed promos <span class="muted">· worse ${worse.length} · better ${better.length}</span></h2>
      <span class="muted small">${promosCount(unchanged)} unchanged</span>
    </div>
    ${worse.length + better.length === 0
      ? html`<p class="muted">No promo’s verdict changed.</p>`
      : html`<div class="table-wrap">
      <table class="changed-lines changed-promos">
        <thead><tr><th scope="col">Promo</th><th scope="col">Expected</th><th scope="col">A</th><th scope="col">B</th></tr></thead>${group('worse', '▲ Worse in B', worse)}${group('better', '▼ Better in B', better)}
      </table>
    </div>`}
  </section>`;
}

function changedRow({ a, b }) {
  const answer = (promo) => html`${promoVerdict(promo)}${answeredKinds(promo)}`;
  return html`
          <tr><td>${promoCell(b)}</td><td>${expectedKinds(b.expected)}</td><td>${answer(a)}</td><td>${answer(b)}</td></tr>`;
}
