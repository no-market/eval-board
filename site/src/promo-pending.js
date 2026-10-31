// The promo run page and comparison until they are built: a message saying
// so, the run page with a link to its run file.
import { flowById } from './flows.js';
import { html } from './html.js';
import { header } from './layout.js';
import { renderNotFound } from './not-found.js';
import { runFileOnGitHub } from './runs.js';

export function renderPromoRunPending({ flow: flowId, id, runFile }) {
  if (!runFile) return renderNotFound(`There is no eval run ${id}.`, flowId);
  return pending(flowId, html`The page of a promo run is not on the eval board yet; its <a href="${runFileOnGitHub(id)}">run file is on GitHub</a>.`);
}

export function renderPromoComparePending({ flow: flowId }) {
  return pending(flowId, 'The comparison of two promo runs is not on the eval board yet.');
}

function pending(flowId, message) {
  const flow = flowById(flowId);
  return String(html`${header(flow.id)}
<main>
  <p class="empty">${message} <a href="#/${flow.id}">Back to ${flow.name}</a></p>
</main>`);
}
