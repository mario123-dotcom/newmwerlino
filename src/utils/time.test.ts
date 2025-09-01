import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSec, lineOffset } from './time';

test('parseSec parses numbers from strings and falls back to default', () => {
  assert.strictEqual(parseSec('1.5s'), 1.5);
  assert.strictEqual(parseSec('3,5'), 3.5);
  assert.strictEqual(parseSec('foo', 2), 2);
  assert.strictEqual(parseSec(4), 4);
});

test('lineOffset applies stagger and clamps within segment duration', () => {
  assert.strictEqual(lineOffset(2, 10, 2), 0.287);
  assert.strictEqual(lineOffset(0, 1, 2), 0);
});
