import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedPromos } from '../src/promo-changes.js';

// A promo run of pages, each [id, promos], as the backend writes them: a
// promo { truth, prediction, name, verdict, errors, warnings }, made up when
// `truth` is null, and the page's predictions, one per promo here, in order.
const run = (...cases) => ({
  cases: cases.map(([id, promos]) => ({
    id,
    chain: id.split('-')[0],
    page: 1,
    predictions: promos.map(({ name, brands }) => ({ name, brands: brands ?? [] })),
    promos: promos.map(({ brands, ...rest }, i) => ({ ...rest, prediction: i })),
  })),
});
const promo = (truth, verdict, errors = [], warnings = []) => ({ truth, name: truth, verdict, errors, warnings });
const madeUp = (name, brands = []) => ({ truth: null, name, brands, verdict: 'error', errors: ['extra'], warnings: [] });

// A changed promo as `page promo: A's verdict → B's verdict`, `—` for none.
const line = ({ page, a, b }) => `${page.id} ${(b ?? a).name}: ${a?.verdict ?? '—'} → ${b?.verdict ?? '—'}`;
const lines = (changes) => ({
  worse: changes.worse.map(line),
  better: changes.better.map(line),
  otherFields: changes.otherFields.map(line),
  unchanged: changes.unchanged,
});

test('changed promos: promos pair by page and reviewed promo; worse and better in B', () => {
  const a = run(['aldi-p1', [promo('o1', 'right'), promo('o2', 'error', ['price'])]], ['lidl-p1', [promo('o1', 'warning', [], ['condition'])]]);
  const b = run(['aldi-p1', [promo('o2', 'right'), promo('o1', 'warning', [], ['condition'])]], ['lidl-p1', [promo('o1', 'warning', [], ['condition'])]]);
  assert.deepEqual(lines(changedPromos(a, b)), {
    worse: ['aldi-p1 o1: right → warning'],
    better: ['aldi-p1 o2: error → right'],
    otherFields: [],
    unchanged: 1,
  });
});

test('changed promos: the same verdict with other fields wrong is its own group; the same fields are unchanged', () => {
  const a = run(['aldi-p1', [promo('o1', 'error', ['price']), promo('o2', 'warning', [], ['condition']), promo('o3', 'error', ['price'], ['condition'])]]);
  const b = run(['aldi-p1', [promo('o1', 'error', ['price_basis']), promo('o2', 'warning', [], ['brands', 'condition']), promo('o3', 'error', ['price'], ['condition'])]]);
  assert.deepEqual(lines(changedPromos(a, b)), {
    worse: [],
    better: [],
    otherFields: ['aldi-p1 o1: error → error', 'aldi-p1 o2: warning → warning'],
    unchanged: 1,
  });
});

test('changed promos: a made-up promo is an error; one made up in B only is worse, one gone in B better', () => {
  const a = run(['aldi-p1', [promo('o1', 'right'), madeUp('Kawa mielona')]]);
  const b = run(['aldi-p1', [promo('o1', 'right'), madeUp('Herbata czarna')]]);
  assert.deepEqual(lines(changedPromos(a, b)), {
    worse: ['aldi-p1 Herbata czarna: — → error'],
    better: ['aldi-p1 Kawa mielona: error → —'],
    otherFields: [],
    unchanged: 1,
  });
});

test('changed promos: made-up promos pair by name folded as Core identity folds it', () => {
  const a = run([
    'aldi-p1',
    [
      madeUp('Kawa mielona Jacobs, 500 g', ['Jacobs']),
      madeUp('Banany luz'),
      madeUp('Śliwki węgierki'),
      madeUp('Ser Gouda Światowid', ['Światowid']),
      madeUp('Masło 82%'),
    ],
  ]);
  const b = run([
    'aldi-p1',
    [madeUp('Masło'), madeUp('KAWA MIELONA 500 g'), madeUp('banany'), madeUp('sliwki – węgierki'), madeUp('Ser gouda ŚWIATOWID')],
  ]);
  assert.deepEqual(lines(changedPromos(a, b)), {
    worse: ['aldi-p1 Masło: — → error'],
    better: ['aldi-p1 Masło 82%: error → —'],
    otherFields: [],
    unchanged: 4,
  });
});
