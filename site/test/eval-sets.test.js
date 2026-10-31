import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentEvalSet, evalSetName, hasVerdicts, inEvalSet, sameEvalSet } from '../src/eval-sets.js';

const SET = { dataset: 'baseline-10', scorer: 'promo-core-text-v6', selection: ['aldi-p002', 'lidl-p006'] };

// An index entry of a promo run: with verdicts unless `errors` is null.
function entry(run, date, evalSet = SET, errors = { count: 1, share: 0.5 }) {
  return { run, date, evalSet, totals: { errors } };
}

test('runs of one dataset revision, scorer version and selection are of one eval set', () => {
  assert.ok(sameEvalSet(SET, { ...SET, selection: [...SET.selection] }));
});

test('runs differing in the dataset revision, the scorer version or the selection are in different eval sets', () => {
  assert.ok(!sameEvalSet(SET, { ...SET, dataset: 'baseline-11' }));
  assert.ok(!sameEvalSet(SET, { ...SET, scorer: 'promo-core-text-v5' }));
  assert.ok(!sameEvalSet(SET, { ...SET, selection: ['aldi-p002'] }));
  assert.ok(!sameEvalSet(SET, { ...SET, selection: ['aldi-p002', 'lidl-p007'] }));
});

test('a run has verdicts when it has errors', () => {
  assert.ok(hasVerdicts(entry('a', '2026-10-31T12:00:00Z')));
  assert.ok(!hasVerdicts(entry('a', '2026-10-31T12:00:00Z', SET, null)));
});

test('the current eval set is that of the newest run with verdicts', () => {
  const older = { ...SET, scorer: 'promo-core-text-v5' };
  const unscored = { ...SET, scorer: 'promo-identity-exact-v2' };
  const runs = [
    entry('newest-without-verdicts', '2026-11-01T10:00:00Z', unscored, null),
    entry('newest-with-verdicts', '2026-10-31T13:00:00Z', SET),
    entry('older', '2026-10-31T12:00:00Z', older),
  ];
  assert.deepEqual(currentEvalSet(runs), SET);
});

test('the newest run is found by date, whatever the order of the runs', () => {
  const older = { ...SET, scorer: 'promo-core-text-v5' };
  const runs = [entry('older', '2026-10-31T12:00:00Z', older), entry('newer', '2026-10-31T13:00:00Z', SET)];
  assert.deepEqual(currentEvalSet(runs), SET);
});

test('with no run with verdicts, there is no current eval set', () => {
  assert.equal(currentEvalSet([entry('a', '2026-10-30T12:00:00Z', SET, null)]), null);
  assert.equal(currentEvalSet([]), null);
});

test('the runs of an eval set are those whose eval set it is, in their order', () => {
  const other = { ...SET, scorer: 'promo-core-text-v5' };
  const runs = [entry('a', '2026-10-31T13:00:00Z'), entry('b', '2026-10-31T12:00:00Z', other), entry('c', '2026-10-31T11:00:00Z')];
  assert.deepEqual(inEvalSet(runs, SET).map((r) => r.run), ['a', 'c']);
});

test('an eval set is named by its dataset revision, scorer version and number of pages', () => {
  assert.equal(evalSetName(SET), 'baseline-10 · promo-core-text-v6 · 2 pages');
  assert.equal(evalSetName({ ...SET, selection: ['aldi-p002'] }), 'baseline-10 · promo-core-text-v6 · 1 page');
});
