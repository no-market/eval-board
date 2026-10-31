import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparedRuns } from '../src/compare.js';

const FLOW = 'promo-extraction';
const SET = { dataset: 'baseline-10', scorer: 'promo-core-text-v6', selection: ['aldi-p002', 'lidl-p006'] };
const OTHER_SET = { ...SET, scorer: 'promo-core-text-v5' };

// An index entry of a promo run: with verdicts unless `errors` is null.
function entry(run, date, evalSet = SET, errors = { count: 1, share: 0.5 }) {
  return { run, flow: FLOW, date, evalSet, totals: { errors } };
}
const route = (a, b) => ({ view: 'compare', flow: FLOW, a, b });

const older = entry('older', '2026-10-31T10:00:00Z');
const newer = entry('newer', '2026-10-31T12:00:00Z');
const otherSet = entry('other-set', '2026-10-31T11:00:00Z', OTHER_SET);
const unscored = entry('unscored', '2026-10-30T18:35:00Z', SET, null);
const unscoredOtherSet = entry('unscored-other-set', '2026-10-30T18:36:00Z', OTHER_SET, null);
const index = { runs: [newer, otherSet, older, unscored, unscoredOtherSet] };

test('routing: two promo runs of one eval set, both with verdicts, are compared, A the older', () => {
  assert.deepEqual(comparedRuns(route('newer', 'older'), index), { a: older, b: newer });
});

test('routing: promo runs of different eval sets are not compared, and the message names both sets', () => {
  assert.deepEqual(comparedRuns(route('older', 'other-set'), index), {
    message:
      'The runs of 31 Oct 2026, 10:00 and 31 Oct 2026, 11:00 are on different eval sets, baseline-10 · promo-core-text-v6 · 2 pages and baseline-10 · promo-core-text-v5 · 2 pages; only two runs of one eval set compare.',
  });
});

test('routing: a promo run without verdicts is not compared, and the message names it', () => {
  assert.deepEqual(comparedRuns(route('older', 'unscored'), index), {
    message:
      'The run of 30 Oct 2026, 18:35 was scored before errors and warnings, so it has no verdicts to compare; only two runs with verdicts compare.',
  });
});

test('routing: two promo runs without verdicts are not compared, and the message names both', () => {
  assert.deepEqual(comparedRuns(route('unscored', 'unscored-other-set'), index), {
    message:
      'The runs of 30 Oct 2026, 18:35 and 30 Oct 2026, 18:36 were scored before errors and warnings, so they have no verdicts to compare; only two runs with verdicts compare.',
  });
});
