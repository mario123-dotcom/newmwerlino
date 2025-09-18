import test from "node:test";
import assert from "node:assert/strict";

import { resolveCliOptions } from "../cliOptions";

test("detects --local passed after --", () => {
  const opts = resolveCliOptions(["--local"], {} as any);
  assert.equal(opts.localOnly, true);
});

test("detects npm start --local via npm_config_local", () => {
  const opts = resolveCliOptions([], { npm_config_local: "true" } as any);
  assert.equal(opts.localOnly, true);
});

test("detects npm start -- --local via npm_config_argv", () => {
  const env = {
    npm_config_argv: JSON.stringify({
      remain: ["--local"],
      cooked: ["run", "start", "--", "--local"],
      original: ["run", "start", "--", "--local"],
    }),
  } as any;
  const opts = resolveCliOptions([], env);
  assert.equal(opts.localOnly, true);
});

test("detects npm start --local from npm_config_argv cooked", () => {
  const env = {
    npm_config_argv: JSON.stringify({
      remain: [],
      cooked: ["run", "start", "--local"],
      original: ["run", "start", "--local"],
    }),
  } as any;
  const opts = resolveCliOptions([], env);
  assert.equal(opts.localOnly, true);
});

test("ignores missing flags", () => {
  const opts = resolveCliOptions([], {} as any);
  assert.equal(opts.localOnly, false);
});

test("ignores falsy npm_config_local", () => {
  const opts = resolveCliOptions([], { npm_config_local: "false" } as any);
  assert.equal(opts.localOnly, false);
});

