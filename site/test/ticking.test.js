import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tick } from '../src/ticking.js';

test('ticking a run adds it; ticking it again unticks it', () => {
  assert.deepEqual(tick([], 'r1'), ['r1']);
  assert.deepEqual(tick(['r1'], 'r2'), ['r1', 'r2']);
  assert.deepEqual(tick(['r1', 'r2'], 'r1'), ['r2']);
});

test('a third tick replaces the oldest of the two', () => {
  assert.deepEqual(tick(['r1', 'r2'], 'r3'), ['r2', 'r3']);
  assert.deepEqual(tick(tick(['r1', 'r2'], 'r3'), 'r4'), ['r3', 'r4']);
});

test('ticking leaves the ticked list it was given as it was', () => {
  const ticked = ['r1', 'r2'];
  tick(ticked, 'r3');
  assert.deepEqual(ticked, ['r1', 'r2']);
});
