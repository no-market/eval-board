import { DEFAULT_FLOW, flowById } from './flows.js';
import { html } from './html.js';
import { header } from './layout.js';

// A message for an address the site can't show (an unknown address, a run
// that doesn't exist, two runs of different flows), with a link back to a tab.
export function renderNotFound(message, flowId = DEFAULT_FLOW) {
  const flow = flowById(flowId);
  return String(html`${header(flow.id)}
<main>
  <p class="empty">${message} <a href="#/${flow.id}">Back to ${flow.name}</a></p>
</main>`);
}
