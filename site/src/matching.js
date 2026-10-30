// Matching lines across two runs. Both runs score the same reviewed truth, so
// a line is the same line when it has the same receipt and the same printed
// text, compared ignoring case and diacritics. Lines with the same printed
// text on one receipt (a product bought twice) match in their order in the
// file; an extra line, with no printed text, matches an extra line on the same
// receipt with the same read text, in order. A line whose text changed beyond
// that is in one run only. This is the one place the rule lives, so a later
// truth with line ids can replace it.

// The lines of runs `a` and `b` over the receipts both have, each pair
// { receipt, a, b } with null for the run a line isn't in: in A's receipt
// order, and within a receipt in B's line order, with a line in A only after
// the line of A before it.
export function matchLines(a, b) {
  const casesOf = (run) => new Map(run.cases.map((c) => [c.receipt, c.lines ?? []]));
  const inB = casesOf(b);
  return a.cases
    .filter((c) => inB.has(c.receipt))
    .flatMap((c) => matchReceipt(c.lines ?? [], inB.get(c.receipt)).map((pair) => ({ receipt: c.receipt, ...pair })));
}

function matchReceipt(aLines, bLines) {
  // A's lines by key, each key's lines in file order, taken as B's match them.
  const waiting = new Map();
  aLines.forEach((line, i) => {
    const k = key(line);
    if (!waiting.has(k)) waiting.set(k, []);
    waiting.get(k).push(i);
  });
  const matched = new Set();
  const pairs = [];
  let next = 0; // the first of A's lines not yet placed
  const placeAOnlyBefore = (end) => {
    for (; next < end; next++) {
      if (!matched.has(next)) pairs.push({ a: aLines[next], b: null });
    }
  };
  for (const line of bLines) {
    const i = waiting.get(key(line))?.shift();
    if (i === undefined) {
      pairs.push({ a: null, b: line });
      continue;
    }
    matched.add(i);
    placeAOnlyBefore(i);
    pairs.push({ a: aLines[i], b: line });
  }
  placeAOnlyBefore(aLines.length);
  return pairs;
}

// What makes two lines of one receipt the same line: the printed text, or for
// an extra line its read text, normalised.
function key(line) {
  return line.text === null || line.text === undefined
    ? `extra:${normalise(line.read?.text ?? '')}`
    : `printed:${normalise(line.text)}`;
}

// A text for comparing, as the backend's `normalise` does: case folded,
// diacritics dropped (`ł` as `l`), runs of spaces as one and the ends trimmed.
export function normalise(text) {
  const plain = text
    .replaceAll('ł', 'l')
    .replaceAll('Ł', 'L')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
  return plain.toLowerCase().replaceAll('ß', 'ss').split(/\s+/).filter(Boolean).join(' ');
}
