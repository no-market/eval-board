import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNotFound } from '../src/not-found.js';

test('an unknown address says so, with a link back to the tab', () => {
  const html = renderNotFound('This address is not on the eval board.');
  assert.match(html, /This address is not on the eval board\./);
  assert.match(html, /<a href="#\/receipt-lines">Back to Receipt lines<\/a>/);
});
