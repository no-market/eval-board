// The page's entry: loads the index once, then renders the view the address
// opens, again on every change of the address. Everything it shows comes
// from this site; it loads nothing from other hosts.
import { comparedRuns, renderCompare } from './compare.js';
import { renderNotFound } from './not-found.js';
import { parseRoute } from './route.js';
import { renderRun } from './run.js';
import { renderTab } from './tab.js';
import { tick } from './ticking.js';

const app = document.getElementById('app');

// The runs ticked for comparing, kept while the page is open.
let ticked = [];

async function start() {
  let index;
  try {
    const response = await fetch('index.json');
    if (!response.ok) throw new Error(`index.json: ${response.status}`);
    index = await response.json();
  } catch (error) {
    app.textContent = `The eval board could not load its index of runs (${error.message}).`;
    return;
  }
  const show = async () => {
    const hash = location.hash;
    let view;
    try {
      view = await render(parseRoute(hash), index);
    } catch (error) {
      view = renderNotFound(`The eval board could not load this run (${error.message}).`);
    }
    if (hash !== location.hash) return; // the address changed while a run loaded
    app.innerHTML = view;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', show);
  // A row's box, or a point on the chart, ticks its run; the tab is drawn
  // again where it is, with the focus kept on what was used.
  const tickRun = (run, selector) => {
    ticked = tick(ticked, run);
    const route = parseRoute(location.hash);
    if (route.view !== 'tab') return;
    app.innerHTML = renderTabOf(route, index);
    app.querySelector(selector)?.focus();
  };
  app.addEventListener('change', (event) => {
    const box = event.target.closest?.('input[data-tick]');
    if (box) tickRun(box.dataset.tick, `input[data-tick="${CSS.escape(box.dataset.tick)}"]`);
  });
  const pointOf = (event) => event.target.closest?.('[data-point]');
  const tickPoint = (point) => tickRun(point.dataset.point, `[data-point="${CSS.escape(point.dataset.point)}"]`);
  app.addEventListener('click', (event) => {
    const point = pointOf(event);
    if (point) tickPoint(point);
  });
  app.addEventListener('keydown', (event) => {
    const point = pointOf(event);
    if (!point || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    tickPoint(point);
  });
  show();
}

async function render(route, index) {
  if (route.view === 'tab') {
    if (route.base && !index.runs.some((run) => run.flow === route.flow && run.run === route.base)) {
      return renderNotFound(`There is no run ${route.base} to set as the baseline.`, route.flow);
    }
    return renderTabOf(route, index);
  }
  if (route.view === 'compare') {
    const compared = comparedRuns(route, index);
    if (compared.message) return renderNotFound(compared.message, route.flow);
    const [a, b] = await Promise.all(
      [compared.a, compared.b].map(async (entry) => ({ id: entry.run, run: await loadRun(entry.file) })),
    );
    return renderCompare({ flow: route.flow, a, b });
  }
  if (route.view === 'run') {
    const entry = index.runs.find((e) => e.run === route.run && e.flow === route.flow);
    return renderRun({ flow: route.flow, id: route.run, runFile: entry && (await loadRun(entry.file)) });
  }
  return renderNotFound('This address is not on the eval board.');
}

function renderTabOf(route, index) {
  const runs = index.runs.filter((run) => run.flow === route.flow);
  return renderTab({ flow: route.flow, runs, base: route.base, ticked });
}

// A run file's copy, which the build writes next to the page.
async function loadRun(file) {
  const response = await fetch(`runs/${encodeURIComponent(file)}`);
  if (!response.ok) throw new Error(`runs/${file}: ${response.status}`);
  return response.json();
}

start();
