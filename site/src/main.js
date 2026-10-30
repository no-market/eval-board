// The page's entry: loads the index once, then renders the view the address
// opens, again on every change of the address. Everything it shows comes
// from this site; it loads nothing from other hosts.
import { renderNotFound } from './not-found.js';
import { parseRoute } from './route.js';
import { renderRun } from './run.js';
import { renderTab } from './tab.js';

const app = document.getElementById('app');

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
  show();
}

async function render(route, index) {
  if (route.view === 'tab') {
    const runs = index.runs.filter((run) => run.flow === route.flow);
    if (route.base && !runs.some((run) => run.run === route.base)) {
      return renderNotFound(`There is no run ${route.base} to set as the baseline.`, route.flow);
    }
    return renderTab({ flow: route.flow, runs, base: route.base });
  }
  if (route.view === 'run') {
    const entry = index.runs.find((run) => run.run === route.run && run.flow === route.flow);
    return renderRun({ flow: route.flow, run: route.run, data: entry && (await loadRun(entry.file)) });
  }
  return renderNotFound('This address is not on the eval board.');
}

// A run file's copy, which the build writes next to the page.
async function loadRun(file) {
  const response = await fetch(`runs/${encodeURIComponent(file)}`);
  if (!response.ok) throw new Error(`runs/${file}: ${response.status}`);
  return response.json();
}

start();
