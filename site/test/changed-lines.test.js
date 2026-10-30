import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedLines } from '../src/changed-lines.js';

const line = (text, verdict) => ({ text, read: { text }, verdict });
const extra = (readText, verdict) => ({ text: null, read: { text: readText }, verdict });
const run = (...cases) => ({ cases: cases.map(([receipt, lines]) => ({ receipt, lines })) });

// A changed line as `receipt text: A's verdict → B's verdict`.
const written = (lines) =>
  lines.map(({ receipt, a, b }) => `${receipt} ${(a ?? b).text ?? (a ?? b).read.text}: ${a?.verdict ?? 'not read'} → ${b?.verdict ?? 'not read'}`);

test('changed lines: only lines whose verdict differs, worse in B and better in B', () => {
  const a = run(['aldi', [line('CHLEB', 'right'), line('SER', 'right'), line('MLEKO', 'error')]]);
  const b = run(['aldi', [line('CHLEB', 'right'), line('SER', 'warning'), line('MLEKO', 'warning')]]);
  const { worse, better } = changedLines(a, b);
  assert.deepEqual(written(worse), ['aldi SER: right → warning']);
  assert.deepEqual(written(better), ['aldi MLEKO: error → warning']);
});

test('changed lines: each group in receipt and line order, whatever the change', () => {
  const a = run(
    ['aldi', [line('A1', 'warning'), line('A2', 'right'), line('A3', 'right'), line('A4', 'error')]],
    ['lidl', [line('L1', 'right'), line('L2', 'error')]],
  );
  const b = run(
    ['aldi', [line('A1', 'error'), line('A2', 'error'), line('A3', 'warning'), line('A4', 'right')]],
    ['lidl', [line('L1', 'warning'), line('L2', 'right')]],
  );
  const { worse, better } = changedLines(a, b);
  assert.deepEqual(written(worse), [
    'aldi A1: warning → error',
    'aldi A2: right → error',
    'aldi A3: right → warning',
    'lidl L1: right → warning',
  ]);
  assert.deepEqual(written(better), ['aldi A4: error → right', 'lidl L2: error → right']);
});

test('changed lines: a line in one run only is not read in the other', () => {
  const a = run(['lidl', [line('KAKI', 'right'), extra('OPUST A', 'error')]]);
  const b = run(['lidl', [line('KAKI', 'right'), extra('OPUST B', 'warning')]]);
  const { worse, better } = changedLines(a, b);
  assert.deepEqual(written(worse), ['lidl OPUST B: not read → warning']);
  assert.deepEqual(written(better), ['lidl OPUST A: error → not read']);
});

test('changed lines: none when the verdicts are the same', () => {
  const a = run(['aldi', [line('CHLEB', 'error')]]);
  assert.deepEqual(changedLines(a, a), { worse: [], better: [], oneRunOnly: [] });
});

test('changed lines: a right line in one run only is neither worse nor better, but read in one run only', () => {
  const a = run(['lidl', [line('KAKI', 'right'), extra('OPUST A', 'right'), extra('OPUST C', 'error')]]);
  const b = run(['lidl', [line('KAKI', 'right'), extra('OPUST B', 'right'), extra('OPUST D', 'warning')]]);
  const { worse, better, oneRunOnly } = changedLines(a, b);
  assert.deepEqual(written(worse), ['lidl OPUST D: not read → warning']);
  assert.deepEqual(written(better), ['lidl OPUST C: error → not read']);
  assert.deepEqual(written(oneRunOnly), ['lidl OPUST B: not read → right', 'lidl OPUST A: right → not read']);
});
