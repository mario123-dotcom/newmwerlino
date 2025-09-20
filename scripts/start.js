#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function run(command, commandArgs, options) {
  const result = spawnSync(command, commandArgs, options);
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

run(npmCmd, ['run', 'build'], { stdio: 'inherit', env: process.env });

const env = { ...process.env };

function truthyFlag(raw) {
  if (typeof raw !== 'string') return false;
  const normalized = raw.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'no';
}

const cliLocal = args.some((arg) => arg === '-local' || arg === '--local');
const envLocal = truthyFlag(env.npm_config_local) || truthyFlag(env.NPM_CONFIG_LOCAL) || truthyFlag(env.LOCAL_ASSETS);

if (cliLocal || envLocal) {
  env.FORCE_LOCAL_ASSETS = env.FORCE_LOCAL_ASSETS ?? '1';
}

const nodeArgs = [path.join(__dirname, '..', 'dist', 'main.js'), ...args];
const runMain = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit', env });
if (runMain.error) {
  throw runMain.error;
}
if (typeof runMain.status === 'number') {
  process.exit(runMain.status);
}
