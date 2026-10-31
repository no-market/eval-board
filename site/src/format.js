// How the site writes numbers, dates and models. Differences (B − A, with
// their marks) build on these.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const twoDigits = (n) => String(n).padStart(2, '0');

// `30 Oct 2026, 16:57`, in UTC, as the run files record it.
export function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${twoDigits(d.getUTCHours())}:${twoDigits(d.getUTCMinutes())}`;
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

// `Aldi, 23 Sep 2026` for the photo `aldi/2026-09-23 12.50.png`: the chain
// and the date of a receipt. A photo named otherwise is given as it is.
export function receiptName(photo) {
  const match = photo.match(/^([^/]+)\/(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) return photo;
  const [, chain, year, month, day] = match;
  return `${chain[0].toUpperCase()}${chain.slice(1)}, ${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

// `$0.55`: a cost per receipt in US dollars, written per 100 receipts.
export function formatPer100(usd) {
  return `$${(usd * 100).toFixed(2)}`;
}

// `gemini-2.5-flash` for `google/gemini-2.5-flash`: the model without its provider.
export function shortModel(model) {
  return model.slice(model.indexOf('/') + 1);
}

// `8 pages`, `1 page`.
export function pagesCount(n) {
  return n === 1 ? '1 page' : `${n} pages`;
}
