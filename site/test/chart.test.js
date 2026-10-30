import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise } from '../build/summarise.js';
import { renderTab } from '../src/tab.js';
import { tick } from '../src/ticking.js';

const REAL = '2026-10-30T165731-google-gemini-2.5-flash-google-gemini-2.5-flash';
const realRun = JSON.parse(
  await readFile(new URL(`./fixtures/${REAL}.json`, import.meta.url), 'utf8'),
);
// The real run: 4 of 45 lines in error, $0.0055384 per receipt.
const entry = summarise(`${REAL}.json`, realRun);
// An older run: 9 of 43 lines in error, 0.66¢ per receipt.
const older = {
  ...entry,
  run: 'older',
  date: '2026-10-29T22:32:00Z',
  models: { read: 'anthropic/claude-haiku-5.5', chooseKinds: 'google/gemini-2.5-flash' },
  lines: 43,
  errors: { count: 9, share: 9 / 43 },
  costUsd: 0.0066,
};

// The chart's section of the tab.
function chart(html) {
  return html.match(/<section aria-labelledby="chart-h"[\s\S]*?<\/section>/)?.[0] ?? '';
}

// Each point on the chart, as { run, x, y, pressed }: x the share of the
// plot's width, y the pixels from the plot's top (320 high).
function points(html) {
  return [...chart(html).matchAll(/<g class="point" data-point="([^"]+)"([^>]*)>\s*<svg x="([\d.]+)%" y="([\d.]+)"/g)].map(
    ([, run, rest, x, y]) => ({ run, x: Number(x), y: Number(y), pressed: /aria-pressed="true"/.test(rest) }),
  );
}

test('a point per run, placed by cost across and error rate up', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older] });
  // Axes of 0 to 0.8¢ and 0 to 25%, so the real run sits at 0.55384 / 0.8 across
  // and 8.9% / 25% up a plot 320 high; the older at 0.66 / 0.8 and 20.9% / 25%.
  assert.deepEqual(
    points(html).map(({ run, x, y }) => ({ run, x, y })),
    [
      { run: REAL, x: 69.23, y: 206.22 },
      { run: 'older', x: 82.5, y: 52.09 },
    ],
  );
});

test('both axes start at 0', () => {
  const svg = chart(renderTab({ flow: 'receipt-lines', runs: [entry, older] }));
  const yLabels = [...svg.matchAll(/<text class="y-tick"[^>]*>([^<]*)<\/text>/g)].map(([, t]) => t);
  const xLabels = [...svg.matchAll(/<text class="x-tick"[^>]*>([^<]*)<\/text>/g)].map(([, t]) => t);
  assert.deepEqual(yLabels, ['0%', '5%', '10%', '15%', '20%', '25%']);
  assert.deepEqual(xLabels, ['0¢', '0.2¢', '0.4¢', '0.6¢', '0.8¢']);
});

// A point's opening tag and the text of its label, by run.
function point(html, run) {
  const g = chart(html).match(new RegExp(`<g class="point" data-point="${run}"[\\s\\S]*?</svg>\\s*</g>`))?.[0] ?? '';
  return {
    open: g.match(/^<g[^>]*>/)?.[0] ?? '',
    label: g.match(/<g class="label">[\s\S]*?<text[^>]*>([^<]*)<\/text>/)?.[1],
  };
}

test('a point is reached by keyboard focus and shows the date and the two models', () => {
  const p = point(renderTab({ flow: 'receipt-lines', runs: [entry, older] }), 'older');
  assert.match(p.open, /tabindex="0"/);
  assert.match(p.open, /role="button"/);
  assert.match(
    p.open,
    /aria-label="Tick the run of 29 Oct 2026, 22:32: claude-haiku-5.5 · gemini-2.5-flash, error rate 20.9%, 0.66¢ per receipt"/,
  );
  assert.equal(p.label, '29 Oct 2026, 22:32 · claude-haiku-5.5 · gemini-2.5-flash');
});

// Each row's box, as [run, ticked].
function boxes(html) {
  return [...html.matchAll(/<input type="checkbox" data-tick="([^"]+)"([^>]*)>/g)].map(([, run, rest]) => [
    run,
    / checked/.test(rest),
  ]);
}

test('clicking a point ticks its run, as its row’s box does, and keeps the boxes in step', () => {
  // What main.js does on a click: tick the run in the point's data-point,
  // then draw the tab again.
  let ticked = [];
  const click = (html, nth) => {
    ticked = tick(ticked, points(html)[nth].run);
    return renderTab({ flow: 'receipt-lines', runs: [entry, older], ticked });
  };
  let html = renderTab({ flow: 'receipt-lines', runs: [entry, older], ticked });
  html = click(html, 1);
  assert.deepEqual(boxes(html), [[REAL, false], ['older', true]]);
  assert.deepEqual(points(html).map(({ pressed }) => pressed), [false, true]);
  assert.match(html, /1 of 2 runs ticked/);
  html = click(html, 0);
  assert.deepEqual(boxes(html), [[REAL, true], ['older', true]]);
  assert.match(html, /Compare 2 runs/);
  html = click(html, 1);
  assert.deepEqual(boxes(html), [[REAL, true], ['older', false]]);
  assert.deepEqual(points(html).map(({ pressed }) => pressed), [true, false]);
});

test('ticked points are marked', () => {
  const html = renderTab({ flow: 'receipt-lines', runs: [entry, older], ticked: ['older'] });
  assert.deepEqual(points(html).map(({ run, pressed }) => [run, pressed]), [[REAL, false], ['older', true]]);
});
