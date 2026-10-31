import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  centsDifference,
  linesDifference,
  per100Difference,
  promosDifference,
  secondsDifference,
} from '../src/differences.js';
import { formatCents, formatPer100 } from '../src/format.js';

// Errors of 9 of 45 lines against 18 of 45: the spec's example.
test('fewer error lines are better, in lines and percentage points', () => {
  assert.deepEqual(
    linesDifference({ count: 18, share: 18 / 45 }, { count: 9, share: 9 / 45 }),
    { mark: 'better', text: '▼ −9 lines · −20.0 pts' },
  );
});

test('more warning lines are worse', () => {
  assert.deepEqual(
    linesDifference({ count: 20, share: 20 / 43 }, { count: 22, share: 22 / 45 }),
    { mark: 'worse', text: '▲ +2 lines · +2.4 pts' },
  );
});

test('the same lines and share are no change', () => {
  assert.deepEqual(
    linesDifference({ count: 4, share: 4 / 45 }, { count: 4, share: 4 / 45 }),
    { mark: 'same', text: '±0' },
  );
});

test('one line more on a larger total, at the same share, is still worse', () => {
  // 5 of 50 against 4 of 40: the same 10.0%.
  assert.deepEqual(
    linesDifference({ count: 4, share: 4 / 40 }, { count: 5, share: 5 / 50 }),
    { mark: 'worse', text: '▲ +1 line · ±0.0 pts' },
  );
});

test('slower seconds are worse, in seconds and per cent', () => {
  assert.deepEqual(secondsDifference(7.8, 14.9), { mark: 'worse', text: '▲ +7.1 s · +91%' });
});

// The spec's example `▲ +9.1 s · +155%` breaks its own rule: +155% is more
// than twice the old value, so it reads as ×N.
test('a rise past double is ×N, not per cent', () => {
  assert.deepEqual(secondsDifference(5.87, 14.97), { mark: 'worse', text: '▲ +9.1 s · ×2.6' });
});

test('seconds at least twice the old read as ×N', () => {
  assert.deepEqual(secondsDifference(2.4, 8.7), { mark: 'worse', text: '▲ +6.3 s · ×3.6' });
  assert.deepEqual(secondsDifference(7.2, 14.4), { mark: 'worse', text: '▲ +7.2 s · ×2.0' });
});

test('faster seconds are better', () => {
  assert.deepEqual(secondsDifference(14.9, 7.8), { mark: 'better', text: '▼ −7.1 s · −48%' });
});

test('a cheaper receipt is better, in cents and per cent', () => {
  assert.equal(formatCents(0.0055), '0.55¢');
  assert.deepEqual(centsDifference(0.0066, 0.0055), { mark: 'better', text: '▼ −0.11¢ · −17%' });
});

test('a dearer receipt is worse, in per cent even past double', () => {
  assert.deepEqual(centsDifference(0.002, 0.005), { mark: 'worse', text: '▲ +0.30¢ · +150%' });
});

test('cost equal to the hundredth of a cent is no change', () => {
  assert.deepEqual(centsDifference(0.005538, 0.005541), { mark: 'same', text: '±0' });
});

test('cost per 100 receipts is in dollars', () => {
  assert.equal(formatPer100(0.0055), '$0.55');
  assert.deepEqual(per100Difference(0.0066, 0.0055), { mark: 'better', text: '▼ −$0.11' });
  assert.deepEqual(per100Difference(0.0055, 0.0066), { mark: 'worse', text: '▲ +$0.11' });
  assert.deepEqual(per100Difference(0.0055, 0.0055), { mark: 'same', text: '±0' });
});

test('from a baseline of zero there is no per cent', () => {
  assert.deepEqual(centsDifference(0, 0.0055), { mark: 'worse', text: '▲ +0.55¢' });
  assert.deepEqual(secondsDifference(0, 3.2), { mark: 'worse', text: '▲ +3.2 s' });
});

test('seconds equal to the tenth are no change', () => {
  assert.deepEqual(secondsDifference(8.82, 8.8), { mark: 'same', text: '±0' });
});

// Errors of 4 of 22 promos against 10 of 22.
test('fewer error promos are better, in promos and percentage points', () => {
  assert.deepEqual(
    promosDifference({ count: 10, share: 10 / 22 }, { count: 4, share: 4 / 22 }),
    { mark: 'better', text: '▼ −6 promos · −27.3 pts' },
  );
});

test('one more promo is worse, in the singular', () => {
  assert.deepEqual(
    promosDifference({ count: 9, share: 9 / 22 }, { count: 10, share: 10 / 22 }),
    { mark: 'worse', text: '▲ +1 promo · +4.5 pts' },
  );
});
