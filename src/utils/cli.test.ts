import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure options can be read from npm_config_argv when env value is boolean

test('getOpt reads npm argv config value', async () => {
  process.env.npm_config_texttransition = 'true';
  process.env.npm_config_argv = JSON.stringify({
    original: ['--textTransition', 'wipeleft'],
  });
  const { getOpt } = await import('../cli');
  assert.equal(getOpt('textTransition', 'wipeup'), 'wipeleft');
});
