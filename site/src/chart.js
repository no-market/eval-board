// A tab's chart of error rate against cost per receipt (or per page), drawn
// as SVG by the site's own code: cost across, error rate up, both from 0, a
// point per run in the flow's colour. A point is a button: hover or focus
// shows its date and models, a click ticks its run (main.js), and a ticked
// point is marked. `of` says what a run's point is (see `receipts`).
import { formatCents, formatDate, formatShare } from './format.js';
import { html } from './html.js';
import { modelPair } from './runs.js';

const HEIGHT = 320; // the plot, in pixels
const BELOW = 26; // room for the cost labels under it
const LABEL_CHAR = 6.8; // the rough width of a character of a 12px label

// The receipt lines tab's points: a run's cost per receipt, its error rate
// over lines, and its two models. Another tab gives its own: `unit`, what
// cost is per; `cost(run)`, { usd, priced }, `priced` false when `usd` is
// the priced part only; `share(run)`, the error rate; `models(run)`, the
// text after the date; `foot`, how cost is counted.
const receipts = {
  unit: 'receipt',
  cost: (run) => ({ usd: run.costUsd, priced: true }),
  share: (run) => run.errors.share,
  models: (run) => modelPair(run.models.read, run.models.chooseKinds),
  foot: 'Cost per receipt, mean over receipts that didn’t fail',
};

export function chart(runs, ticked, of = receipts) {
  const x = axis(Math.max(...runs.map((run) => of.cost(run).usd)), 0.01);
  const y = axis(Math.max(...runs.map(of.share)), 0.1);
  const across = (usd) => round((usd / x.max) * 100);
  const up = (share) => round(HEIGHT - (share / y.max) * HEIGHT);
  return html`<section aria-labelledby="chart-h" class="chart">
    <div class="chart-head">
      <h2 id="chart-h">Error rate against cost per ${of.unit}</h2>
      <span class="muted small">Lower left is better · click a point to tick its run</span>
    </div>
    <div class="chart-body">
      <svg class="y-axis" width="48" height="${HEIGHT + BELOW}" aria-hidden="true">
        ${y.ticks.map((v) => html`<text class="y-tick" x="40" y="${up(v)}" dy="0.35em" text-anchor="end">${amount(v * 100, '%')}</text>`)}
      </svg>
      <svg class="plot" width="100%" height="${HEIGHT + BELOW}" role="group" aria-label="Error rate against cost per ${of.unit}, a point per run">
        ${y.ticks.map((v) => html`<line class="grid" x1="0" x2="100%" y1="${up(v)}" y2="${up(v)}"></line>`)}
        <line class="axis" x1="0" x2="100%" y1="${HEIGHT}" y2="${HEIGHT}"></line>
        <line class="axis" x1="0" x2="0" y1="0" y2="${HEIGHT}"></line>
        ${x.ticks.map((v, i) => html`<text class="x-tick" x="${across(v)}%" y="${HEIGHT + 18}" text-anchor="${i === 0 ? 'start' : i === x.ticks.length - 1 ? 'end' : 'middle'}">${amount(v * 100, '¢')}</text>`)}
        ${runs.map((run) => point(run, of, ticked.includes(run.run), across(of.cost(run).usd), up(of.share(run))))}
      </svg>
    </div>
    <p class="muted small chart-foot">${of.foot}</p>
  </section>`;
}

// A point: a 44px target round a dot, and the label shown on hover, on focus
// and while ticked, to its right, or to its left near the right edge.
function point(run, of, isTicked, x, y) {
  const date = formatDate(run.date);
  const models = of.models(run);
  const { usd, priced } = of.cost(run);
  const text = `${date} · ${models}`;
  const width = Math.round(text.length * LABEL_CHAR + 12);
  const left = x > 60;
  return html`
        <g class="point" data-point="${run.run}" tabindex="0" role="button" aria-pressed="${isTicked ? 'true' : 'false'}" aria-label="Tick the run of ${date}: ${models}, error rate ${formatShare(of.share(run))}, ${priced ? '' : 'at least '}${formatCents(usd)} per ${of.unit}">
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

// An axis from 0 to just above `max`, in at most five steps of 1, 2 or 5
// times a power of ten; `fallback` is its top when every value is 0.
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

// `0.2¢`, `15%`: a tick's value without trailing zeros.
function amount(value, unit) {
  return `${Number(value.toFixed(4))}${unit}`;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
