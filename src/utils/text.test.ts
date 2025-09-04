import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapParagraph, normalizeQuotes, escDrawText, fitText } from './text';

test('wrapParagraph breaks text into lines respecting width', () => {
  assert.deepStrictEqual(
    wrapParagraph('uno due tre', 7),
    ['uno', 'due tre']
  );
});

test('wrapParagraph wraps at about 30 chars', () => {
  const txt = 'Una serie di scosse, a partire da domenica';
  assert.deepStrictEqual(
    wrapParagraph(txt, 30),
    ['Una serie di', 'scosse, a partire da domenica']
  );
});

test('wrapParagraph uses common-sense breaks', () => {
  const s = 'una serie di scosse, a partire da domenica, ha colpito i campi flegrei, culminando con una di magnitudo 4.0 alle 4:55 di lunedì.';
  assert.deepStrictEqual(
    wrapParagraph(s, 30),
    [
      'una serie di scosse, a partire',
      'da domenica, ha colpito i',
      'campi flegrei, culminando',
      'con una di magnitudo',
      '4.0 alle 4:55 di lunedì.'
    ]
  );
  const s2 = "nonostante l'intensità delle scosse, la protezione civile riporta che non ci sono danni significativi finora.";
  assert.deepStrictEqual(
    wrapParagraph(s2, 30),
    [
      "nonostante l'intensità delle",
      'scosse, la protezione civile',
      'riporta che non ci sono',
      'danni significativi finora.'
    ]
  );
});

test('wrapParagraph wraps at about 30 chars', () => {
  const txt = 'Una serie di scosse, a partire da domenica';
  assert.deepStrictEqual(
    wrapParagraph(txt, 30),
    ['Una serie di', 'scosse, a partire da domenica']
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

test('fitText wraps and shrinks text to fit box', () => {
  const sample = 'uno due tre quattro cinque sei sette otto nove dieci';
  const res = fitText(sample, 100, 60, 40);
  assert.ok(res.text.includes('\n'));
  assert.ok(res.fontSize < 40);
});

test('fitText accepts custom line height', () => {
  const sample = 'uno due tre quattro cinque sei sette otto nove dieci';
  const defaultRes = fitText(sample, 100, 60, 40);
  const tallRes = fitText(sample, 100, 60, 40, 2);
  assert.ok(tallRes.fontSize <= defaultRes.fontSize);
});
