// The changed lines of a comparison: over the receipts both runs have, every
// line whose verdict differs between A and B, matched by `matchLines`.
import { matchLines } from './matching.js';

// How bad a verdict is. A line in one run only is not read in the other, and
// counts as right there: an extra line B reads and gets wrong is worse in B.
const BADNESS = { right: 0, warning: 1, error: 2 };
const badness = (line) => (line ? BADNESS[line.verdict] ?? 0 : 0);
const verdict = (line) => line?.verdict ?? null;

// { worse, better }: the changed lines worse in B (right → warning, right →
// error, warning → error), and the rest, better in B; each a list of
// { receipt, a, b }, null for the run a line isn't in, in receipt and line order.
export function changedLines(a, b) {
  const changed = matchLines(a, b).filter((pair) => verdict(pair.a) !== verdict(pair.b));
  return {
    worse: changed.filter((pair) => badness(pair.b) > badness(pair.a)),
    better: changed.filter((pair) => badness(pair.b) <= badness(pair.a)),
  };
}
