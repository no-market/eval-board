// How the site writes numbers, dates and models. Differences (B − A, with
// their marks) build on these.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');

// `30 Oct 2026, 16:57`, in UTC, as the run files record it.
export function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

// `8.9%`
export function formatShare(share) {
  return `${(share * 100).toFixed(1)}%`;
}

// `14.9 s`
export function formatSeconds(seconds) {
  return `${seconds.toFixed(1)} s`;
}

// `0.55¢`: a cost in US dollars, written in cents.
export function formatCents(usd) {
  return `${(usd * 100).toFixed(2)}¢`;
}

// `gemini-2.5-flash` for `google/gemini-2.5-flash`: the model without its provider.
export function shortModel(model) {
  return model.slice(model.indexOf('/') + 1);
}
