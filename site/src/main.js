// The page's entry: loads the index once, then renders the view the address
// opens, again on every change of the address. Everything it shows comes
// from this site; it loads nothing from other hosts.
import { renderNotFound } from './not-found.js';
import { parseRoute } from './route.js';
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
  const show = () => {
    app.innerHTML = render(parseRoute(location.hash), index);
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', show);
  show();
}

function render(route, index) {
  if (route.view === 'tab') {
    const runs = index.runs.filter((run) => run.flow === route.flow);
    if (route.base && !runs.some((run) => run.run === route.base)) {
      return renderNotFound(`There is no run ${route.base} to set as the baseline.`, route.flow);
    }
    return renderTab({ flow: route.flow, runs, base: route.base });
  }
  return renderNotFound('This address is not on the eval board.');
}

start();
