// The promo comparison until it is built: a message saying so.
import { flowById } from './flows.js';
import { html } from './html.js';
import { header } from './layout.js';

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
