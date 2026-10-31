// Differences: run B read against its baseline A, B − A, in the formats of the
// spec's Differences. Lower is better for every number, so a fall is
// `better` (▼), a rise `worse` (▲) and no change `same` (±0). Each function
// returns { mark, text }; the tab and the comparison colour `text` by `mark`.

const MINUS = '−';

// Errors or warnings, each { count, share } of a run's lines:
// `▼ −9 lines · −20.0 pts`.
export function linesDifference(a, b) {
  return countDifference(a, b, 'line', 'lines');
}

// Errors or warnings, each { count, share } of a promo run's promos:
// `▼ −6 promos · −27.3 pts`.
export function promosDifference(a, b) {
  return countDifference(a, b, 'promo', 'promos');
}

function countDifference(a, b, one, many) {
  const count = b.count - a.count;
  const points = round((b.share - a.share) * 100, 1);
  return difference(Math.sign(points) || Math.sign(count), [
    `${signed(count, 0)} ${Math.abs(count) === 1 ? one : many}`,
    `${signed(points, 1)} pts`,
  ]);
}

// Seconds per receipt: `▲ +7.1 s · +91%`, or `▲ +6.3 s · ×3.6` when B
// took at least twice as long.
export function secondsDifference(a, b) {
  const seconds = round(b - a, 1);
  const change = a > 0 && b >= 2 * a ? `×${(b / a).toFixed(1)}` : perCent(a, b);
  return difference(Math.sign(seconds), [`${signed(seconds, 1)} s`, change].filter(Boolean));
}

// Cost per receipt, each in US dollars, written in cents: `▼ −0.11¢ · −17%`.
export function centsDifference(aUsd, bUsd) {
  const cents = round((bUsd - aUsd) * 100, 2);
  return difference(Math.sign(cents), [`${signed(cents, 2)}¢`, perCent(aUsd, bUsd)].filter(Boolean));
}

// Cost per 100 receipts, from each run's cost per receipt in US dollars,
// written in dollars: `▼ −$0.11`.
export function per100Difference(aUsd, bUsd) {
  const dollars = round((bUsd - aUsd) * 100, 2);
  const sign = signed(dollars, 2);
  return difference(Math.sign(dollars), [`${sign[0]}$${sign.slice(1)}`]);
}

// The change from a to b in per cent, `−17%`; none from zero.
function perCent(a, b) {
  if (a === 0) return null;
  return `${signed(round(((b - a) / a) * 100, 0), 0)}%`;
}

function difference(direction, parts) {
  if (direction === 0) return { mark: 'same', text: '±0' };
  return direction < 0
    ? { mark: 'better', text: `▼ ${parts.join(' · ')}` }
    : { mark: 'worse', text: `▲ ${parts.join(' · ')}` };
}

// `+9.1`, `−0.11`, `±0.0`: a value with its sign, the minus a true minus.
function signed(value, digits) {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return `±${text}`;
  return `${value < 0 ? MINUS : '+'}${text}`;
}

// Rounded to `digits` places, so a change too small to be written is none.
function round(value, digits) {
  return Number(value.toFixed(digits));
}
