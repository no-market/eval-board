import { DEFAULT_FLOW, flowById } from './flows.js';

// The view an address opens, from `location.hash`. Hash routes, so every
// address works on Pages without a server:
//   (bare site), #/<flow>      the flow's tab
//   #/<flow>?base=<run>        the tab with that run as the baseline
// Anything else is { view: 'not-found' }.
export function parseRoute(hash) {
  const [address, query = ''] = hash.replace(/^#/, '').split('?');
  const path = address.replace(/^\/+/, '');
  const [flow, ...rest] = path === '' ? [DEFAULT_FLOW] : path.split('/');
  if (!flowById(flow)) return { view: 'not-found' };
  if (rest.length === 0) {
    const base = new URLSearchParams(query).get('base');
    return base ? { view: 'tab', flow, base } : { view: 'tab', flow };
  }
  return { view: 'not-found' };
}

// The address of a flow's tab, with `base` as its baseline or none.
export function tabAddress(flow, base) {
  return base ? `#/${flow}?base=${encodeURIComponent(base)}` : `#/${flow}`;
}
