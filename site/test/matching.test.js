import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchLines } from '../src/matching.js';

// Hand-made lines: a printed line by its text, an extra line by its read text.
const printed = (text, verdict = 'right') => ({ text, read: { text }, verdict });
const extra = (readText, verdict = 'warning') => ({ text: null, read: { text: readText }, verdict });
const run = (...cases) => ({ cases: cases.map(([receipt, lines]) => ({ receipt, lines })) });

// The pairs as [receipt, A's line's text, B's line's text], null for a missing side.
const pairs = (matched) =>
  matched.map(({ receipt, a, b }) => [receipt, a && (a.text ?? `read: ${a.read.text}`), b && (b.text ?? `read: ${b.read.text}`)]);

test('matching: a line with the same printed text, case and diacritics aside, is the same line', () => {
  const a = run(['aldi', [printed('JAJA 10L ŚCIÓŁKOWE'), printed('MLEKO  3,2%')]]);
  const b = run(['aldi', [printed('Jaja 10l sciolkowe'), printed('mleko 3,2% ')]]);
  assert.deepEqual(pairs(matchLines(a, b)), [
    ['aldi', 'JAJA 10L ŚCIÓŁKOWE', 'Jaja 10l sciolkowe'],
    ['aldi', 'MLEKO  3,2%', 'mleko 3,2% '],
  ]);
});

test('matching: a product bought twice matches in its order in the file', () => {
  const a = run(['aldi', [printed('GOLONKA KG', 'right'), printed('CHLEB'), printed('GOLONKA KG', 'error')]]);
  const b = run(['aldi', [printed('GOLONKA KG', 'error'), printed('CHLEB'), printed('GOLONKA KG', 'warning')]]);
  assert.deepEqual(
    matchLines(a, b).map(({ a, b }) => [a.text, a.verdict, b.verdict]),
    [['GOLONKA KG', 'right', 'error'], ['CHLEB', 'right', 'right'], ['GOLONKA KG', 'error', 'warning']],
  );
});

test('matching: extra lines match extra lines with the same read text, in order; one in one run only', () => {
  const a = run(['lidl', [printed('KAKI'), extra('OPUST'), extra('Opust'), printed('GRANAT')]]);
  const b = run(['lidl', [printed('KAKI'), extra('opust'), extra('OPUSTY ŁĄCZNIE'), printed('GRANAT')]]);
  assert.deepEqual(pairs(matchLines(a, b)), [
    ['lidl', 'KAKI', 'KAKI'],
    ['lidl', 'read: OPUST', 'read: opust'],
    ['lidl', null, 'read: OPUSTY ŁĄCZNIE'],
    ['lidl', 'read: Opust', null],
    ['lidl', 'GRANAT', 'GRANAT'],
  ]);
});

test('matching: an extra line never matches a printed line with its text', () => {
  const a = run(['lidl', [printed('OPUST')]]);
  const b = run(['lidl', [extra('OPUST')]]);
  assert.deepEqual(pairs(matchLines(a, b)), [
    ['lidl', null, 'read: OPUST'],
    ['lidl', 'OPUST', null],
  ]);
});

test('matching: a printed line whose text changed beyond case and diacritics is in one run only', () => {
  const a = run(['aldi', [printed('MASLO 200G C')]]);
  const b = run(['aldi', [printed('MASLO 200G')]]);
  assert.deepEqual(pairs(matchLines(a, b)), [
    ['aldi', null, 'MASLO 200G'],
    ['aldi', 'MASLO 200G C', null],
  ]);
});

test('matching: only the receipts both runs have, in A’s order', () => {
  const a = run(['aldi', [printed('CHLEB')]], ['only-a', [printed('SER')]], ['lidl', [printed('KAKI')]]);
  const b = run(['lidl', [printed('KAKI')]], ['only-b', [printed('JAJA')]], ['aldi', [printed('CHLEB')]]);
  assert.deepEqual(pairs(matchLines(a, b)), [
    ['aldi', 'CHLEB', 'CHLEB'],
    ['lidl', 'KAKI', 'KAKI'],
  ]);
});
