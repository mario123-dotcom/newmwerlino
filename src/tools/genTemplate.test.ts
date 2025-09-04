import assert from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectUsedSlides } from './genTemplate';
import { projectRoot } from '../paths';

test('collectUsedSlides filters invisible or zero-duration slides', () => {
  const raw = readFileSync(join(projectRoot, 'template', 'risposta_horizontal.json'), 'utf8');
  const mods = JSON.parse(raw).modifications;
  const used = collectUsedSlides(mods);
  assert.deepStrictEqual(used, [0,1,2,3,4]);
});
