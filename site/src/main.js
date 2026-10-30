// The page's entry: loads the index once, then renders the view the address
// opens, again on every change of the address. Everything it shows comes
// from this site; it loads nothing from other hosts.
import { comparedRuns, renderCompare } from './compare.js';
import { renderNotFound } from './not-found.js';
import { parseRoute } from './route.js';
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
  // Each showing counts, so a run file that arrives after the address has
  // changed again is dropped.
  let showing = 0;
  const show = async () => {
    const shown = ++showing;
    const page = await render(parseRoute(location.hash), index);
    if (shown !== showing) return;
    app.innerHTML = page;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', show);
  // A row's box ticks its run; the tab is drawn again where it is, with the
  // focus kept on the box.
  app.addEventListener('change', (event) => {
    const box = event.target.closest?.('input[data-tick]');
    if (!box) return;
    ticked = tick(ticked, box.dataset.tick);
    const route = parseRoute(location.hash);
    if (route.view !== 'tab') return;
    app.innerHTML = renderTabOf(route, index);
    app.querySelector(`input[data-tick="${CSS.escape(box.dataset.tick)}"]`)?.focus();
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
    const runs = comparedRuns(route, index);
    if (runs.message) return renderNotFound(runs.message, route.flow);
    try {
      const [a, b] = await Promise.all([runs.a, runs.b].map(loadRun));
      return renderCompare({ flow: route.flow, a, b });
    } catch (error) {
      return renderNotFound(`The comparison could not load its run files (${error.message}).`, route.flow);
    }
  }
  return renderNotFound('This address is not on the eval board.');
}

function renderTabOf(route, index) {
  const runs = index.runs.filter((run) => run.flow === route.flow);
  return renderTab({ flow: route.flow, runs, base: route.base, ticked });
}

// A run file, as the build copied it beside the index: { id, run }.
async function loadRun(entry) {
  const response = await fetch(`runs/${encodeURIComponent(entry.file)}`);
  if (!response.ok) throw new Error(`${entry.file}: ${response.status}`);
  return { id: entry.run, run: await response.json() };
}

start();
