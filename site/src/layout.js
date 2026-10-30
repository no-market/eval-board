import { FLOWS } from './flows.js';
import { html } from './html.js';

// The site's header: its name, a link to the run files and a tab per flow,
// `current` marked. Every view starts with it.
export function header(current) {
  return html`<header class="site">
  <div class="bar">
    <div class="brand"><span class="name">Eval board</span><span class="org">no-market</span></div>
    <a class="small" href="https://github.com/no-market/eval-board/tree/main/runs">Run files on GitHub</a>
  </div>
  <nav aria-label="Flows">${FLOWS.map((flow) => tab(flow, flow.id === current))}</nav>
</header>`;
}

function tab(flow, isCurrent) {
  return html`<a href="#/${flow.id}"${isCurrent ? html` aria-current="page"` : ''} style="--flow: ${flow.colour}"><span class="dot" aria-hidden="true"></span>${flow.name}</a>`;
}
