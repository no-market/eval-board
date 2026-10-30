import { DEFAULT_FLOW, flowById } from './flows.js';

// The view an address opens, from `location.hash`. Hash routes, so every
// address works on Pages without a server:
//   (bare site), #/<flow>      the flow's tab
//   #/<flow>?base=<run>        the tab with that run as the baseline
//   #/<flow>/run/<run>         a run page; <run> is its file name without .json
// Each <run> is written as a URI component (see runAddress, compareAddress).
//   #/<flow>/compare/<a>/<b>   the comparison of runs A and B
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
  const ids = rest.slice(1).map(decoded);
  if (ids.includes(null)) return { view: 'not-found' };
  if (rest[0] === 'run' && ids.length === 1 && ids[0]) return { view: 'run', flow, run: ids[0] };
  if (rest[0] === 'compare' && ids.length === 2 && ids[0] && ids[1]) {
    return { view: 'compare', flow, a: ids[0], b: ids[1] };
  }
  return { view: 'not-found' };
}

// A run id from an address, or null for a broken escape.
function decoded(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

// The address of a run page.
export function runAddress(flow, run) {
  return `#/${flow}/run/${encodeURIComponent(run)}`;
}

// The address of the comparison of runs `a` and `b` of a flow, A the older.
export function compareAddress(flow, a, b) {
  return `#/${flow}/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;
}

// The address of a flow's tab, with `base` as its baseline or none.
export function tabAddress(flow, base) {
  return base ? `#/${flow}?base=${encodeURIComponent(base)}` : `#/${flow}`;
}
