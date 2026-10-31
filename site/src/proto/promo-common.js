// PROTOTYPE, throwaway: what the promo views share — names, formats,
// differences, the chart and the variant switcher.
import { formatCents, formatDate, formatSeconds, formatShare, shortModel } from '../format.js';
import { html } from '../html.js';

export const VARIANTS = [
  { key: 'A', name: 'One table, current eval set' },
  { key: 'B', name: 'A section per eval set' },
  { key: 'C', name: 'Chains as columns, every run' },
];

const params = new URLSearchParams(location.search);
export const variant = VARIANTS.some((v) => v.key === params.get('variant')) ? params.get('variant') : 'A';
export const withRescored = params.get('data') === 'rescored';

export const dash = html`<span class="muted">—</span>`;
export const orDash = (value, format) => (value === null || value === undefined ? dash : format(value));
export const chainName = (chain) => chain[0].toUpperCase() + chain.slice(1);

// `promo-v3 · gemini-2.5-flash`, or each chain's model when they differ.
export function modelsLine(run) {
  const models = [...new Set(Object.values(run.configs).map((c) => shortModel(c.model)))];
  return `${run.prompt} · ${models.join(' / ')}`;
}

// `aldi text · biedronka image · …`: each chain's input strategy.
export function strategies(run) {
  return Object.entries(run.configs).map(([chain, c]) => `${chain} ${c.strategy}`).join(' · ');
}

export function runLabel(run) {
  return html`${formatDate(run.date)}${run.rescoredFrom ? html` <span class="rescored" title="PROTOTYPE: the real predictions of run ${run.rescoredFrom}, re-scored locally with promo-core-text-v5 on today's 8 pages; never published">re-scored</span>` : ''}`;
}

// `45.5% (10 of 22)`
export function shareOf(count, promos) {
  if (!count) return dash;
  return html`${formatShare(count.share)} <span class="muted">(${count.count} of ${promos})</span>`;
}

// Cost per page, or the known part marked `≥` when some calls weren't priced.
export function costPerPage(run) {
  if (run.costUsd !== null) return formatCents(run.costUsd);
  if (run.knownCostUsd) return html`<span title="Some calls were not priced; this is the priced part">≥ ${formatCents(run.knownCostUsd)}</span>`;
  return dash;
}

export const secondsPerPage = (run) => orDash(run.seconds?.median, formatSeconds);

const MINUS = '−';
const signed = (value, digits) => {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return `±${text}`;
  return `${value < 0 ? MINUS : '+'}${text}`;
};
const mark = (direction, parts) => {
  if (direction === 0) return { mark: 'same', text: '±0' };
  return direction < 0 ? { mark: 'better', text: `▼ ${parts.join(' · ')}` } : { mark: 'worse', text: `▲ ${parts.join(' · ')}` };
};

// Errors or warnings of two runs: `▼ −6 promos · −27.3 pts`.
export function promosDifference(a, b) {
  if (!a || !b) return null;
  const n = b.count - a.count;
  const points = Number(((b.share - a.share) * 100).toFixed(1));
  return mark(Math.sign(points) || Math.sign(n), [`${signed(n, 0)} ${Math.abs(n) === 1 ? 'promo' : 'promos'}`, `${signed(points, 1)} pts`]);
}

export function centsDifference(a, b) {
  if (a === null || b === null) return null;
  const cents = Number(((b - a) * 100).toFixed(2));
  const pc = a ? `${signed(Number((((b - a) / a) * 100).toFixed(0)), 0)}%` : null;
  return mark(Math.sign(cents), [`${signed(cents, 2)}¢`, pc].filter(Boolean));
}

export function secondsDifference(a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return null;
  const s = Number((b - a).toFixed(1));
  const change = a > 0 && b >= 2 * a ? `×${(b / a).toFixed(1)}` : a ? `${signed(Number((((b - a) / a) * 100).toFixed(0)), 0)}%` : null;
  return mark(Math.sign(s), [`${signed(s, 1)} s`, change].filter(Boolean));
}

export function diffCell(d) {
  return d ? html`<div class="diff ${d.mark}">${d.text}</div>` : '';
}

// The chart: error rate up, cost per page across, a point per run with
// verdicts. `hollow`: run ids drawn as hollow grey points (another eval set).
const HEIGHT = 300;
const BELOW = 26;
export function promoChart(runs, ticked, { hollow = new Set(), title = 'Error rate against cost per page' } = {}) {
  const plotted = runs.filter((r) => r.errors);
  if (plotted.length === 0) return '';
  const cost = (r) => r.costUsd ?? r.knownCostUsd ?? 0;
  const x = axis(Math.max(...plotted.map(cost)), 0.01);
  const y = axis(Math.max(...plotted.map((r) => r.errors.share)), 0.1);
  const across = (usd) => Math.round((usd / x.max) * 10000) / 100;
  const up = (share) => Math.round((HEIGHT - (share / y.max) * HEIGHT) * 100) / 100;
  return html`<section class="chart">
    <div class="chart-head">
      <h2>${title}</h2>
      <span class="muted small">Lower left is better · click a point to tick its run${hollow.size ? ' · hollow: another eval set, not comparable' : ''}</span>
    </div>
    <div class="chart-body">
      <svg class="y-axis" width="48" height="${HEIGHT + BELOW}" aria-hidden="true">
        ${y.ticks.map((v) => html`<text class="y-tick" x="40" y="${up(v)}" dy="0.35em" text-anchor="end">${Number((v * 100).toFixed(4))}%</text>`)}
      </svg>
      <svg class="plot" width="100%" height="${HEIGHT + BELOW}">
        ${y.ticks.map((v) => html`<line class="grid" x1="0" x2="100%" y1="${up(v)}" y2="${up(v)}"></line>`)}
        <line class="axis" x1="0" x2="100%" y1="${HEIGHT}" y2="${HEIGHT}"></line>
        <line class="axis" x1="0" x2="0" y1="0" y2="${HEIGHT}"></line>
        ${x.ticks.map((v, i) => html`<text class="x-tick" x="${across(v)}%" y="${HEIGHT + 18}" text-anchor="${i === 0 ? 'start' : i === x.ticks.length - 1 ? 'end' : 'middle'}">${Number((v * 100).toFixed(4))}¢</text>`)}
        ${plotted.map((r) => point(r, ticked.includes(r.run), hollow.has(r.run), across(cost(r)), up(r.errors.share)))}
      </svg>
    </div>
    <p class="muted small chart-foot">Cost per page, mean over the run's pages</p>
  </section>`;
}

function point(run, isTicked, isHollow, x, y) {
  const text = `${formatDate(run.date)} · ${modelsLine(run)}${run.rescoredFrom ? ' · re-scored' : ''}`;
  const width = Math.round(text.length * 6.8 + 12);
  const left = x > 60;
  return html`
        <g class="point${isHollow ? ' hollow' : ''}" data-point="${run.run}" tabindex="0" role="button" aria-pressed="${isTicked ? 'true' : 'false'}">
          <svg x="${x}%" y="${y}" overflow="visible">
            <circle class="target" r="22"></circle>
            ${isTicked ? html`<circle class="ring" r="12"></circle>` : ''}
            <circle class="dot" r="${isTicked ? 8 : 6}"></circle>
            <g class="label">
              <rect x="${left ? -14 - width : 14}" y="-11" width="${width}" height="22" rx="4"></rect>
              <text x="${left ? -20 : 20}" dy="0.35em" text-anchor="${left ? 'end' : 'start'}">${text}</text>
            </g>
          </svg>
        </g>`;
}

function axis(max, fallback) {
  if (!(max > 0)) return { max: fallback, ticks: [0, fallback] };
  for (let power = Math.floor(Math.log10(max)) - 1; ; power += 1) {
    for (const unit of [1, 2, 5]) {
      const step = unit * 10 ** power;
      const n = Math.ceil(max / step - 1e-9);
      if (n <= 5) {
        const ticks = Array.from({ length: n + 1 }, (_, i) => Number((i * step).toPrecision(12)));
        return { max: ticks[n], ticks };
      }
    }
  }
}

// The floating bar: ← variant →, and the data the prototype shows.
export function switcher() {
  const i = VARIANTS.findIndex((v) => v.key === variant);
  const current = VARIANTS[i];
  return html`<div class="proto-bar" role="toolbar" aria-label="Prototype">
    <span class="proto-tag">PROTOTYPE</span>
    <button type="button" data-variant="${VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length].key}" aria-label="Previous variant">←</button>
    <strong>${current.key}</strong> <span>${current.name}</span>
    <button type="button" data-variant="${VARIANTS[(i + 1) % VARIANTS.length].key}" aria-label="Next variant">→</button>
    <label class="proto-data"><input type="checkbox" data-rescored${withRescored ? html` checked` : ''}> + 6 old runs re-scored with v5</label>
  </div>`;
}

export function goTo({ variant: v = variant, rescored = withRescored }) {
  const p = new URLSearchParams();
  p.set('variant', v);
  if (rescored) p.set('data', 'rescored');
  location.href = `${location.pathname}?${p}${location.hash}`;
}

export function wireSwitcher() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('.proto-bar [data-variant]');
    if (b) goTo({ variant: b.dataset.variant });
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches?.('.proto-bar [data-rescored]')) goTo({ rescored: e.target.checked });
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    const i = VARIANTS.findIndex((v) => v.key === variant);
    if (e.key === 'ArrowLeft') goTo({ variant: VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length].key });
    if (e.key === 'ArrowRight') goTo({ variant: VARIANTS[(i + 1) % VARIANTS.length].key });
  });
}
