// What every flow's tab shares: comparing ticked runs, setting a baseline and
// showing a row's differences from it, and the hint above the table.
import { formatDate } from './format.js';
import { html } from './html.js';
import { compareAddress, tabAddress } from './route.js';
import { tickedPair } from './ticking.js';

// How many of `runs` are ticked, and the button that opens their comparison
// once two are.
export function compareButton(flow, runs, ticked) {
  const pair = tickedPair(ticked, runs);
  const n = runs.filter((run) => ticked.includes(run.run)).length;
  return html`<div class="compare-bar">
      <span class="muted" aria-live="polite">${pair ? '2 runs ticked' : `${n} of 2 runs ticked`}</span>
      ${pair
        ? html`<a class="compare-button" href="${compareAddress(flow.id, pair[0].run, pair[1].run)}">Compare 2 runs</a>`
        : html`<button type="button" class="compare-button" disabled>Tick 2 runs to compare</button>`}
    </div>`;
}

// `1 eval run`, `3 eval runs`
export function runsLine(n) {
  return n === 1 ? '1 eval run' : `${n} eval runs`;
}

// The line beside the table's heading: the baseline, or how to set one, and
// the marks of the differences.
export function baselineHint(base) {
  return html`<span class="muted small">${base ? `Differences against the baseline, ${formatDate(base.date)}` : 'Set a baseline with a row’s “Set as baseline” to see every other run against it'} · <span class="better">▼ better</span> · <span class="worse">▲ worse</span></span>`;
}

// A row's box for comparing.
export function tickBox(run, isTicked) {
  return html`<td class="tick"><label><input type="checkbox" data-tick="${run.run}"${isTicked ? html` checked` : ''} aria-label="Compare the run of ${formatDate(run.date)}"></label></td>`;
}

// The classes of a row: the baseline's, and a ticked run's.
export function rowClasses(isBase, isTicked) {
  const classes = [isBase && 'base', isTicked && 'ticked'].filter(Boolean).join(' ');
  return classes ? html` class="${classes}"` : '';
}

// The difference of `run` from `base` under a number, from `difference(base,
// run)` ({ mark, text }, or null for none): nothing on the baseline's row or
// without a baseline.
export function fromBase(base, run) {
  return (difference) => {
    if (!base || run === base) return '';
    const found = difference(base, run);
    return found ? html`<div class="diff ${found.mark}">${found.text}</div>` : '';
  };
}

// A link, as the baseline lives only in the address: it sets this run as the
// baseline, or on the baseline's row clears it.
export function baseButton(flow, run, isBase) {
  const date = formatDate(run.date);
  return isBase
    ? html`<a class="base-button" href="${tabAddress(flow.id, null)}" aria-pressed="true" role="button" aria-label="Clear the baseline, the run of ${date}">Baseline ✕</a>`
    : html`<a class="base-button" href="${tabAddress(flow.id, run.run)}" aria-pressed="false" role="button" aria-label="Set the run of ${date} as baseline">Set as baseline</a>`;
}
