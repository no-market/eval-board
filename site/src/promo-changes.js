// The promos whose verdict changed between two promo runs of one eval set.
// Promos pair across the runs by page and reviewed promo. A made-up promo has
// no reviewed promo, so it pairs with a made-up promo of the same page by its
// name: first by the name's identity, then by its core identity, as the
// backend's scorer pairs a prediction with a reviewed promo (`identity` and
// `core` in evals/promos.py). This is the one place the rule lives.

// How bad a verdict is. A promo one run doesn't have counts as right there: a
// made-up promo, an error, is worse in the run it appears in.
const BADNESS = { right: 0, warning: 1, error: 2 };
const badness = (promo) => (promo ? BADNESS[promo.verdict] ?? 0 : 0);

// { worse, better, otherFields, unchanged }: over the pages both runs have,
// the promos worse in B (a made-up promo appearing among them), better in B (a
// made-up promo gone among them), and with the same verdict but other fields
// wrong, each a list of { page, a, b } with `page` A's case and null for the
// run a promo isn't in, in A's page order and within a page A's promo order,
// a promo in B only after them; and the number of promos unchanged.
export function changedPromos(a, b) {
  const pagesB = new Map(b.cases.map((c) => [c.id, c]));
  const pairs = a.cases
    .filter((page) => pagesB.has(page.id))
    .flatMap((page) => pairPage(page, pagesB.get(page.id)).map((pair) => ({ page, ...pair })));
  const worse = pairs.filter((pair) => badness(pair.b) > badness(pair.a));
  const better = pairs.filter((pair) => badness(pair.b) < badness(pair.a));
  const otherFields = pairs.filter((pair) => badness(pair.b) === badness(pair.a) && fields(pair.a) !== fields(pair.b));
  return { worse, better, otherFields, unchanged: pairs.length - worse.length - better.length - otherFields.length };
}

// The fields a promo has wrong, errors then warnings, each sorted.
function fields(promo) {
  return promo ? JSON.stringify([[...promo.errors].sort(), [...promo.warnings].sort()]) : '';
}

// The promos of one page in A and B, paired: each of A's with B's or null,
// then each of B's left with null.
function pairPage(aPage, bPage) {
  const aPromos = aPage.promos ?? [];
  const bPromos = bPage.promos ?? [];
  const partner = new Map(); // A's promo → B's
  const taken = new Set();
  const pairBy = (same) => {
    for (const promo of aPromos) {
      if (partner.has(promo)) continue;
      const found = bPromos.find((other) => !taken.has(other) && same(promo, other));
      if (found) {
        partner.set(promo, found);
        taken.add(found);
      }
    }
  };
  const madeUp = (promo) => promo.truth === null;
  const nameOf = (page, promo) => page.predictions?.[promo.prediction] ?? { name: promo.name, brands: [] };
  pairBy((x, y) => !madeUp(x) && x.truth === y.truth);
  pairBy((x, y) => madeUp(x) && madeUp(y) && identity(x.name) === identity(y.name));
  pairBy((x, y) => {
    if (!madeUp(x) || !madeUp(y)) return false;
    const [px, py] = [nameOf(aPage, x), nameOf(bPage, y)];
    const key = core(px.name, px.brands ?? []);
    return key !== '' && key === core(py.name, py.brands ?? []);
  });
  return [
    ...aPromos.map((promo) => ({ a: promo, b: partner.get(promo) ?? null })),
    ...bPromos.filter((promo) => !taken.has(promo)).map((promo) => ({ a: null, b: promo })),
  ];
}

// A name's identity, as the backend's `identity`: case folded, diacritics
// dropped, and anything but letters, digits and `_` as one space between
// words. Lower case stands in for casefold, with `ß` as `ss`; `ł` has no
// decomposition, so stays `ł`, as in the backend.
export function identity(name) {
  const folded = name.toLowerCase().replaceAll('ß', 'ss').normalize('NFKD').replace(/\p{M}/gu, '');
  return folded.split(/[^\p{L}\p{N}_]+/u).filter(Boolean).join(' ');
}

// Sold-unit and pack wording that names how, not what, is sold (the
// backend's PACK_WORDS and PACK_UNITS).
const PACK_WORDS = new Set(['luz', 'luzem', 'sztuka', 'siatka', 'tacka', 'peczek', 'opak', 'opakowanie']);
const PACK_UNITS = new Set(['g', 'kg', 'ml', 'l', 'szt']);

// A name's core identity, as the backend's `core`: its identity without the
// words of `brands`, pack sizes and sold-unit words. A number is a pack size
// only before its unit: 82% fat is part of the product.
export function core(name, brands) {
  const tokens = identity(name).split(' ').filter(Boolean);
  for (const brand of brands) {
    const words = identity(brand).split(' ').filter(Boolean);
    if (words.length === 0) continue;
    for (let start = 0; start + words.length <= tokens.length; start++) {
      if (words.every((word, i) => tokens[start + i] === word)) tokens.fill(null, start, start + words.length);
    }
  }
  return tokens
    .filter(
      (token, i) =>
        token !== null &&
        !PACK_WORDS.has(token) &&
        !PACK_UNITS.has(token) &&
        !(/^\d+$/.test(token) && PACK_UNITS.has(tokens[i + 1])),
    )
    .join(' ');
}
