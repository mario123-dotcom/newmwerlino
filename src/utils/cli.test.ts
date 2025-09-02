import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure options can be read from npm_config_argv when env value is boolean

test('getOpt reads npm argv config value', async () => {
  process.env.npm_config_texttransition = 'true';
  process.env.npm_config_argv = JSON.stringify({
    original: ['--textTransition', 'wipeleft'],
  });
  delete require.cache[require.resolve('../cli')];
  const { getOpt } = require('../cli');
  assert.equal(getOpt('textTransition', 'wipeup'), 'wipeleft');
});

// Fallback: npm flag without value but trailing arg

test('getOpt falls back to stray argv when npm flag has no value', async () => {
  const origArgv = process.argv;
  process.argv = ['node', 'file', 'wipeleft'];
  process.env.npm_config_texttransition = 'true';
  delete process.env.npm_config_argv;
  delete require.cache[require.resolve('../cli')];
  const { getOpt } = require('../cli');
  assert.equal(getOpt('textTransition', 'wipeup'), 'wipeleft');
  process.argv = origArgv;
});
