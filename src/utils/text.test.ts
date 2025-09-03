import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapParagraph, normalizeQuotes, escDrawText } from './text';

test('wrapParagraph breaks text into lines respecting width', () => {
  assert.deepStrictEqual(
    wrapParagraph('uno due tre', 7),
    ['uno due', 'tre']
  );
});

test('wrapParagraph wraps at about 30 chars', () => {
  const txt = 'Una serie di scosse, a partire da domenica';
  assert.deepStrictEqual(
    wrapParagraph(txt, 30),
    ['Una serie di scosse, a partire', 'da domenica']
  );
});

test('wrapParagraph handles empty input', () => {
  assert.deepStrictEqual(wrapParagraph('', 5), ['']);
});

test('normalizeQuotes replaces apostrophes with curly quotes', () => {
  assert.strictEqual(normalizeQuotes("l'auto"), 'l’auto');
});

test('escDrawText doubles backslashes', () => {
  assert.strictEqual(escDrawText('\\'), '\\\\');
});

test('escDrawText escapes colons', () => {
  assert.strictEqual(escDrawText(':'), '\\:');
});

test("escDrawText escapes single quotes", () => {
  assert.strictEqual(escDrawText("'"), "\\'");
});
