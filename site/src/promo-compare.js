// The comparison of two promo runs of one eval set, both with verdicts, at
// #/promo-extraction/compare/<a>/<b> (comparedRuns refuses any other pair):
// a heading with two run cards, then its sections in order. A section is a
// function of the comparison (see `comparison`) to HTML; a later section is
// added to SECTIONS, reading what it needs from the comparison.
import { wrappable } from './compare.js';
import { promosDifference, secondsDifference } from './differences.js';
import { evalSetName } from './eval-sets.js';
import { flowById } from './flows.js';
import { formatDate, formatSeconds, pagesCount } from './format.js';
import { dash, html } from './html.js';
import { header } from './layout.js';
import { changedPromos } from './promo-changes.js';
import { chainName, chainsInRuns, costCell, costDifference, modelsLine, pageLabel, promoRun, shareOf, strategiesLine } from './promo-runs.js';
import { runAddress } from './route.js';

// What every section reads: the flow, runs A and B, each { id, run, read }
// with `run` the run file as it is and `read` it as promoRun reads it, and
// the chains of either, in alphabetical order.
function comparison({ flow, a, b }) {
  const [readA, readB] = [a, b].map(({ run }) => promoRun(run));
  return { flow: flowById(flow), a: { ...a, read: readA }, b: { ...b, read: readB }, chains: chainsInRuns([readA, readB]) };
}

// The summary by chain, from each run's own numbers: a row per number, A, B
// and B − A for the total and each chain. A chain one run lacks is `—`.
function summary({ a, b, chains }) {
  const columns = [
    { name: 'Total', of: (run) => run.totals },
    ...chains.map((chain) => ({ name: chainName(chain), of: (run) => run.byChain[chain] ?? null })),
  ];
  const total = (i) => (i === 0 ? ' total' : '');
  return html`<section aria-labelledby="summary-h" class="summary">
    <div class="section-head">
      <h2 id="summary-h">Summary by chain</h2>
      <span class="muted small"><span class="better">▼ better</span> · <span class="worse">▲ worse</span> · lower is better everywhere</span>
    </div>
    <div class="table-wrap">
      <table class="by-step">
        <thead>
          <tr>
            <th scope="col" rowspan="2"></th>
            ${columns.map((column, i) => html`<th scope="colgroup" colspan="3" class="group${total(i)}">${column.name}</th>`)}
          </tr>
          <tr>${columns.map((_, i) => html`<th scope="col" class="num${total(i)}">A</th><th scope="col" class="num${total(i)}">B</th><th scope="col" class="num${total(i)}">B − A</th>`)}</tr>
        </thead>
        <tbody>${SUMMARY_ROWS.map((row) => html`
          <tr>
            <th scope="row">${row.name}</th>${columns.map((column, i) => cells(row, column.of(a.read), column.of(b.read), total(i)))}
          </tr>`)}
        </tbody>
      </table>
    </div>
    <p class="muted small">Each difference reads B against A: promos and percentage points for errors and warnings, counted in promos; seconds and the change in per cent (×N when B takes at least twice as long) for the median seconds per page; cents (¢) per page for cost, ≥ the priced part, with no difference, when some calls weren’t priced. Each run’s own numbers, over all its pages.</p>
  </section>`;
}

// The summary's rows: how a total's or a chain's numbers are written, and the
// difference of two, or null for none.
const SUMMARY_ROWS = [
  { name: 'Errors', format: (n) => shareOf(n), difference: (a, b) => promosDifference(a.errors, b.errors) },
  { name: 'Warnings', format: (n) => shareOf(n, 'warnings'), difference: (a, b) => promosDifference(a.warnings, b.warnings) },
  { name: 's / page, median', format: (n) => formatSeconds(n.seconds.median), difference: (a, b) => secondsDifference(a.seconds.median, b.seconds.median) },
  { name: 'Cost / page', format: costCell, difference: costDifference },
];

function cells(row, a, b, total) {
  const found = a && b ? row.difference(a, b) : null;
  const written = (n) => (n ? row.format(n) : dash);
  return html`<td class="num nowrap${total}">${written(a)}</td><td class="num nowrap${total}">${written(b)}</td><td class="diff ${found ? found.mark : 'same'} num${total}">${found ? wrappable(found.text) : ''}</td>`;
}

// The changed promos, over the pages both runs have (see `changedPromos`):
// worse in B, better in B, then the same verdict with other fields, each
// counted, and how many promos are unchanged. It shows the changes and
// doesn't judge them.
function changed({ a, b }) {
  const { worse, better, otherFields, unchanged } = changedPromos(a.run, b.run);
  const count = worse.length + better.length + otherFields.length;
  const group = (mark, title, pairs) =>
    pairs.length === 0
      ? ''
      : html`
        <tbody class="${mark}">
          <tr class="group"><th scope="colgroup" colspan="4">${title} · ${promosCount(pairs.length)}</th></tr>${pairs.map(changedRow)}
        </tbody>`;
  return html`<section aria-labelledby="changed-h" class="changed">
    <div class="section-head">
      <h2 id="changed-h">Changed promos <span class="muted">· worse ${worse.length} · better ${better.length} · other fields ${otherFields.length}</span></h2>
      <span class="muted small">${promosCount(unchanged)} unchanged</span>
    </div>
    ${count === 0
      ? html`<p class="muted">No promo’s verdict or fields changed.</p>`
      : html`<div class="table-wrap">
      <table class="changed-lines changed-promos">
        <thead><tr><th scope="col">Page</th><th scope="col">Promo</th><th scope="col">A</th><th scope="col">B</th></tr></thead>${group('worse', '▲ Worse in B', worse)}${group('better', '▼ Better in B', better)}${group('one-run-only', 'The same verdict, other fields', otherFields)}
      </table>
    </div>`}
    <p class="muted small">Promos pair by page and reviewed promo; a made-up promo, an error, by its name, folded to its core identity. A made-up promo gone in B is better; one new in B is worse.</p>
  </section>`;
}

function changedRow({ page, a, b }) {
  const promo = b ?? a;
  const madeUp = promo.truth === null ? html` <span class="muted small">made up</span>` : '';
  return html`
          <tr><td class="nowrap">${pageLabel(page.chain, page.page)}</td><td>${promo.name}${madeUp}</td><td>${promoVerdict(a)}</td><td>${promoVerdict(b)}</td></tr>`;
}

// A promo's verdict and the fields it has wrong, errors in bold, then
// warnings: `error price · condition`; `—` for a run the promo isn't in.
function promoVerdict(promo) {
  if (!promo) return dash;
  const field = (name) => (name === 'extra' ? 'made up' : name);
  const errors = promo.errors.map((name, i) => html`${i > 0 ? ', ' : ''}<strong>${field(name)}</strong>`);
  const warnings = promo.warnings.map((name, i) => html`${i > 0 ? ', ' : ''}${field(name)}`);
  const separator = errors.length > 0 && warnings.length > 0 ? ' · ' : '';
  return html`<span class="verdict ${promo.verdict}">${promo.verdict}</span> <span class="small">${errors}${separator}${warnings}</span>`;
}

// `22 promos`, `1 promo`.
function promosCount(n) {
  return n === 1 ? '1 promo' : `${n} promos`;
}

// The sections of the comparison, in order, after its heading.
const SECTIONS = [summary, changed];

// The page of the comparison of promo runs `a` and `b`, each { id, run }, A the older.
export function renderPromoCompare({ flow, a, b }) {
  const c = comparison({ flow, a, b });
  return String(html`${header(c.flow.id)}
<main class="compare" style="--flow: ${c.flow.colour}">
  ${heading(c)}
  ${SECTIONS.map((section) => section(c))}
</main>`);
}

// The heading: the eval set both runs are on, and a card for each.
function heading({ flow, a, b }) {
  return html`<div class="compare-heading">
    <a class="back" href="#/${flow.id}">← All promo runs</a>
    <h1>Comparing two eval runs</h1>
    <p class="muted">Both on the eval set <strong>${evalSetName(a.read.evalSet)}</strong></p>
    <div class="run-cards">
      ${runCard(flow, 'A', 'older', a)}
      ${runCard(flow, 'B', 'newer', b)}
    </div>
  </div>`;
}

function runCard(flow, letter, age, { id, read: run }) {
  const failed = run.totals.failedPages;
  return html`<a class="run-card" href="${runAddress(flow.id, id)}">
        <span class="run-card-title"><span class="letter letter-${letter.toLowerCase()}">${letter}</span><strong>${formatDate(run.date)}</strong><span class="muted small">${age}</span></span>
        <span>${run.prompt} · <span title="${strategiesLine(run.configs)}">${modelsLine(run.configs)}</span></span>
        <span class="muted small">commit <code>${run.commit.slice(0, 7)}</code> · ${pagesCount(run.totals.pages)}${failed > 0 ? ` (${failed} failed)` : ''}</span>
      </a>`;
}
