import test from "node:test";
import assert from "node:assert/strict";
import { buildTimeline } from "./timeline";
import { HOLD_EXTRA_MS } from "./config";

test("buildTimeline ends with outro without tail filler", () => {
  const mods: any = {
    "Immagine-0": "1", // trigger slide presence
    "Slide_0.time": 0,
    "Slide_0.duration": 2,
    "Testo-0": "ciao",
    "Outro.duration": 1,
  };

  const timeline = buildTimeline(mods, 5);
  const last = timeline[timeline.length - 1];
  assert.equal(last.kind, "outro");
  const expectedTotal = 2 + HOLD_EXTRA_MS / 1000 + 1;
  assert.ok(Math.abs(
    timeline.reduce((sum, s) => sum + s.duration, 0) - expectedTotal
  ) < 1e-6);
});
