import { DEFAULT_FLOW, flowById } from './flows.js';

// The view an address opens, from `location.hash`. Hash routes, so every
// address works on Pages without a server:
//   (bare site), #/<flow>      the flow's tab
//   #/<flow>/run/<run>         a run page; <run> is its file name without .json
// Anything else is { view: 'not-found' }.
export function parseRoute(hash) {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '');
  const [flow, ...rest] = path === '' ? [DEFAULT_FLOW] : path.split('/');
  if (!flowById(flow)) return { view: 'not-found' };
  if (rest.length === 0) return { view: 'tab', flow };
  if (rest.length === 2 && rest[0] === 'run' && rest[1] !== '') return { view: 'run', flow, run: rest[1] };
  return { view: 'not-found' };
}
