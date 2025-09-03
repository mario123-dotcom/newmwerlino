import test from "node:test";
import assert from "node:assert/strict";
import { buildFirstSlideTextChain, buildRevealTextChain_XFADE } from "./filters";

const opts = {
  segDur: 5,
  fontfile: "dummy.ttf",
  videoW: 1920,
  videoH: 1080,
  fps: 30
};

test("text chains use ascent/descent for consistent spacing", () => {
  const chainFirst = buildFirstSlideTextChain(
    "prima riga", opts.segDur, opts.fontfile, opts.videoW, opts.videoH, opts.fps
  );
  assert.ok(chainFirst.includes("h-ascent-descent-1"));
  assert.ok(!chainFirst.includes("text_h"));

  const chainOther = buildRevealTextChain_XFADE(
    "seconda riga", opts.segDur, opts.fontfile, opts.videoW, opts.videoH, opts.fps
  );
  assert.ok(chainOther.includes("h-ascent-descent-1"));
  assert.ok(!chainOther.includes("text_h"));
});
