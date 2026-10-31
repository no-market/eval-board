// PROTOTYPE, throwaway: three variants of the promos tab, by ?variant=.
//   A  one table of the current eval set; other sets folded below, not ticked
//   B  a section per eval set, each with its own chart, table and comparing
//   C  every run in one table, error rate per chain as columns; any two compare
import { flowById } from '../flows.js';
import { formatDate, formatShare } from '../format.js';
import { html } from '../html.js';
import { header } from '../layout.js';
import { compareAddress, runAddress, tabAddress } from '../route.js';
import { tickedPair } from '../ticking.js';
import {
  centsDifference, chainName, costPerPage, diffCell, dash, modelsLine, orDash, promoChart,
  promosDifference, runLabel, secondsDifference, secondsPerPage, shareOf, strategies, switcher, variant,
} from './promo-common.js';

export function renderPromoTab({ flow: flowId, runs, base: baseId = null, ticked = [] }) {
  const flow = flowById(flowId);
  const base = runs.find((r) => r.run === baseId) ?? null;
  const body = { A: variantA, B: variantB, C: variantC }[variant](flow, runs, base, ticked);
  return String(html`${header(flow.id)}
<main style="--flow: ${flow.colour}" class="promo">
  ${body}
</main>
${switcher()}`);
}

// The eval sets of the runs, newest first, each with its runs.
function evalSets(runs) {
  const sets = new Map();
  for (const r of runs) {
    if (!sets.has(r.evalSet.key)) sets.set(r.evalSet.key, { ...r.evalSet, runs: [] });
    sets.get(r.evalSet.key).runs.push(r);
  }
  return [...sets.values()];
}

const currentSet = (runs) => evalSets(runs.filter((r) => r.errors))[0] ?? evalSets(runs)[0];

function heading(flow, line, compare = '') {
  return html`<div class="tab-head">
    <div class="heading">
      <h1 style="color: ${flow.colour}">${flow.name}</h1>
      <p class="muted">${line}</p>
    </div>
    ${compare}
  </div>`;
}

function compareBar(flow, runs, ticked, hint = 'Tick 2 runs to compare') {
  const pair = tickedPair(ticked, runs);
  const n = runs.filter((r) => ticked.includes(r.run)).length;
  return html`<div class="compare-bar">
      <span class="muted">${pair ? '2 runs ticked' : `${n} of 2 runs ticked`}</span>
      ${pair
        ? html`<a class="compare-button" href="${compareAddress(flow.id, pair[0].run, pair[1].run)}">Compare 2 runs</a>`
        : html`<button type="button" class="compare-button" disabled>${hint}</button>`}
    </div>`;
}

function setChip(set, { current = false, short = false } = {}) {
  const title = `dataset ${set.dataset}, scorer ${set.scorer}, ${set.pages} pages`;
  if (short) return html`<span class="set-chip${current ? ' current' : ''}" title="${title}">scorer <strong>${set.scorer.replace(/^.*-(v\d+)$/, '$1')}</strong> · ${set.pages} pages</span>`;
  return html`<span class="set-chip${current ? ' current' : ''}" title="${title}">${set.dataset} · <strong>${set.scorer}</strong> · ${set.pages} pages</span>`;
}

// The table of runs with verdicts, as on the receipt lines tab.
function verdictTable(flow, runs, base, ticked, { tickable = true, caption = 'Eval runs, newest first' } = {}) {
  return html`<section class="runs">
    <div class="runs-head">
      <h2>${caption}</h2>
      <span class="muted small">${base ? `Differences against the baseline, ${formatDate(base.date)}` : 'Set a baseline to see every other run against it'} · <span class="better">▼ better</span> · <span class="worse">▲ worse</span></span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${tickable ? html`<th class="tick"></th>` : ''}
          <th>Date</th><th>Prompt · model</th><th class="num">Pages</th>
          <th class="num">Error rate</th><th class="num">Warning rate</th>
          <th class="num">s / page</th><th class="num">Cost / page</th><th class="num">Baseline</th>
        </tr></thead>
        <tbody>${runs.map((r) => verdictRow(flow, r, base, ticked, tickable))}</tbody>
      </table>
    </div>
    <p class="muted small">Shares in brackets are counted in promos: every promo of the pages, plus every made-up one. Seconds are the median per page; cost is the mean per page.</p>
  </section>`;
}

function verdictRow(flow, r, base, ticked, tickable) {
  const isBase = base === r;
  const sameSet = base && base.evalSet.key === r.evalSet.key;
  const from = (d) => (!base || isBase ? '' : sameSet ? diffCell(d) : html`<div class="diff same" title="The baseline is on another eval set">other set</div>`);
  const classes = [isBase && 'base', ticked.includes(r.run) && 'ticked'].filter(Boolean).join(' ');
  return html`
          <tr class="${classes}">
            ${tickable ? html`<td class="tick"><label><input type="checkbox" data-tick="${r.run}"${ticked.includes(r.run) ? html` checked` : ''}></label></td>` : ''}
            <td class="nowrap"><a href="${runAddress(flow.id, r.run)}">${runLabel(r)}</a></td>
            <td><span title="${strategies(r)}">${modelsLine(r)}</span></td>
            <td class="num">${r.pages}</td>
            <td class="num nowrap"><strong>${shareOf(r.errors, r.promos)}</strong>${from(promosDifference(base?.errors, r.errors))}</td>
            <td class="num nowrap">${shareOf(r.warnings, r.promos)}${from(promosDifference(base?.warnings, r.warnings))}</td>
            <td class="num nowrap">${secondsPerPage(r)}${from(secondsDifference(base?.seconds.median, r.seconds.median))}</td>
            <td class="num nowrap">${costPerPage(r)}${from(centsDifference(base?.costUsd ?? null, r.costUsd))}</td>
            <td class="num base-cell">${baseButton(flow, r, isBase)}</td>
          </tr>`;
}

function baseButton(flow, r, isBase) {
  return isBase
    ? html`<a class="base-button" href="${tabAddress(flow.id, null)}" aria-pressed="true" role="button">Baseline ✕</a>`
    : html`<a class="base-button" href="${tabAddress(flow.id, r.run)}" aria-pressed="false" role="button">Set as baseline</a>`;
}

// Runs scored before errors and warnings: their own numbers, never ticked.
function oldTable(flow, runs, { withSet = true } = {}) {
  return html`<div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Prompt · model</th>${withSet ? html`<th>Eval set</th>` : ''}<th class="num">Matched</th><th class="num">Missed</th><th class="num">Made up</th><th class="num">Recall</th><th class="num">Precision</th><th class="num">Failed pages</th><th class="num">s / page</th><th class="num">Cost / page</th></tr></thead>
        <tbody>${runs.map((r) => html`
          <tr>
            <td class="nowrap"><a href="${runAddress(flow.id, r.run)}">${runLabel(r)}</a></td>
            <td><span title="${strategies(r)}">${modelsLine(r)}</span></td>
            ${withSet ? html`<td>${setChip(r.evalSet)}</td>` : ''}
            <td class="num">${r.matched} <span class="muted">of ${r.truth}</span></td>
            <td class="num">${r.missed}</td><td class="num">${r.extra}</td>
            <td class="num">${orDash(r.recall, formatShare)}</td><td class="num">${orDash(r.precision, formatShare)}</td>
            <td class="num">${r.failedPages}</td>
            <td class="num">${secondsPerPage(r)}</td><td class="num">${costPerPage(r)}</td>
          </tr>`)}
        </tbody>
      </table>
    </div>`;
}

// A: the current eval set is the tab; everything else is history, folded.
function variantA(flow, runs, base, ticked) {
  const set = currentSet(runs);
  const current = set.runs;
  const others = runs.filter((r) => r.evalSet.key !== set.key);
  const currentBase = base && base.evalSet.key === set.key ? base : null;
  return html`${heading(flow, html`${current.length} eval runs on the current eval set ${setChip(set, { current: true })} · each is one prompt and a model per chain on every reviewed page`, compareBar(flow, current, ticked))}
  ${promoChart(current, ticked)}
  ${verdictTable(flow, current, currentBase, ticked)}
  ${others.length ? html`<details class="block-fold">
    <summary>Runs on other eval sets · ${others.length} <span class="muted">— another scorer or other pages, so their numbers don't compare with the table above</span></summary>
    ${otherSetsTable(flow, others)}
  </details>` : ''}`;
}

function otherSetsTable(flow, runs) {
  const withVerdicts = runs.filter((r) => r.errors);
  const without = runs.filter((r) => !r.errors);
  return html`${withVerdicts.length ? html`<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Prompt · model</th><th>Eval set</th><th class="num">Error rate</th><th class="num">Warning rate</th><th class="num">s / page</th><th class="num">Cost / page</th></tr></thead>
        <tbody>${withVerdicts.map((r) => html`<tr><td class="nowrap"><a href="${runAddress(flow.id, r.run)}">${runLabel(r)}</a></td><td>${modelsLine(r)}</td><td>${setChip(r.evalSet)}</td><td class="num">${shareOf(r.errors, r.promos)}</td><td class="num">${shareOf(r.warnings, r.promos)}</td><td class="num">${secondsPerPage(r)}</td><td class="num">${costPerPage(r)}</td></tr>`)}</tbody>
      </table></div>` : ''}
    ${without.length ? html`<p class="muted small fold-note">Scored before errors and warnings: matched, missed and made-up promos instead.</p>${oldTable(flow, without)}` : ''}`;
}

// B: a section per eval set, newest first; the newest open, older folded.
function variantB(flow, runs, base, ticked) {
  const sets = evalSets(runs);
  return html`${heading(flow, `${runs.length} eval runs on ${sets.length} eval sets · runs compare only within an eval set: the same dataset revision, scorer and pages`)}
  ${sets.map((set, i) => {
    const hasVerdicts = set.runs.some((r) => r.errors);
    const setBase = base && base.evalSet.key === set.key ? base : null;
    const inner = hasVerdicts
      ? html`<div class="set-tools">${compareBar(flow, set.runs, ticked, 'Tick 2 runs of this set')}</div>
        ${promoChart(set.runs, ticked, { title: 'Error rate against cost per page, this eval set' })}
        ${verdictTable(flow, set.runs, setBase, ticked)}`
      : html`<p class="muted small fold-note">Scored before errors and warnings, so not compared: matched, missed and made-up promos instead.</p>${oldTable(flow, set.runs, { withSet: false })}`;
    return html`<details class="set-section"${i === 0 ? html` open` : ''}>
      <summary>${setChip(set, { current: i === 0 })} <span class="muted">· ${set.runs.length} ${set.runs.length === 1 ? 'run' : 'runs'}, newest ${formatDate(set.runs[0].date)}</span></summary>
      <div class="set-body">${inner}</div>
    </details>`;
  })}`;
}

// C: every run in one table; error rate per chain as columns; any two runs
// with verdicts compare, across eval sets with a mark.
function variantC(flow, runs, base, ticked) {
  const set = currentSet(runs);
  const chains = [...new Set(runs.flatMap((r) => Object.keys(r.byChain)))].sort();
  const hollow = new Set(runs.filter((r) => r.evalSet.key !== set.key).map((r) => r.run));
  const tickable = runs.filter((r) => r.errors);
  const pair = tickedPair(ticked, tickable);
  const crossSet = pair && pair[0].evalSet.key !== pair[1].evalSet.key;
  return html`${heading(flow, html`${runs.length} eval runs · error rate in total and by chain · newest eval set ${setChip(set, { current: true })}`, html`<div class="compare-stack">${compareBar(flow, tickable, ticked)}${crossSet ? html`<span class="cross-note">⚠ different eval sets: compared with a mark</span>` : ''}</div>`)}
  ${promoChart(runs, ticked, { hollow })}
  <section class="runs">
    <div class="runs-head">
      <h2>Eval runs, newest first</h2>
      <span class="muted small">Error rate per chain · grey rows are on another eval set than the newest</span>
    </div>
    <div class="table-wrap">
      <table class="by-chain">
        <thead><tr>
          <th class="tick"></th><th>Date</th><th>Prompt · model</th><th>Eval set</th>
          <th class="num">Errors</th>${chains.map((c) => html`<th class="num">${chainName(c)}</th>`)}<th class="num">Warnings</th>
          <th class="num">s / page</th><th class="num">Cost / page</th>
        </tr></thead>
        <tbody>${runs.map((r) => html`
          <tr class="${[r.evalSet.key !== set.key && 'other-set', ticked.includes(r.run) && 'ticked'].filter(Boolean).join(' ')}">
            <td class="tick">${r.errors ? html`<label><input type="checkbox" data-tick="${r.run}"${ticked.includes(r.run) ? html` checked` : ''}></label>` : ''}</td>
            <td class="nowrap"><a href="${runAddress(flow.id, r.run)}">${runLabel(r)}</a></td>
            <td class="nowrap"><span title="${strategies(r)}">${modelsLine(r)}</span></td>
            <td>${setChip(r.evalSet, { current: r.evalSet.key === set.key, short: true })}</td>
            ${r.errors
              ? html`<td class="num nowrap"><strong>${formatShare(r.errors.share)}</strong> <span class="muted">(${r.errors.count}/${r.promos})</span></td>
            ${chains.map((c) => chainCell(r.byChain[c]))}
            <td class="num nowrap">${formatShare(r.warnings.share)}</td>`
              : html`<td colspan="${chains.length + 2}" class="muted small">scored before errors and warnings · matched ${r.matched} of ${r.truth}, recall ${orDash(r.recall, formatShare)}</td>`}
            <td class="num">${secondsPerPage(r)}</td><td class="num">${costPerPage(r)}</td>
          </tr>`)}
        </tbody>
      </table>
    </div>
    <p class="muted small">Chain cells: errors of that chain's promos. Netto is out of the MVP; older runs have Netto pages, which today's eval set leaves out.</p>
  </section>`;
}

function chainCell(n) {
  if (!n || !n.errors) return html`<td class="num">${dash}</td>`;
  const pct = Math.round(n.errors.share * 100);
  return html`<td class="num nowrap chain-cell" title="${n.errors.count} errors of ${n.promos} promos on ${n.pages} pages"><span class="bar" style="--w: ${pct}%"></span>${pct}% <span class="muted">${n.errors.count}/${n.promos}</span></td>`;
}

export { dash };
