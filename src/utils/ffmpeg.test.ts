import test from "node:test";
import assert from "node:assert/strict";
import { ffmpegSafePath } from "./ffmpeg";

test("ffmpegSafePath escapes drive colon, spaces and brackets", () => {
  const out = ffmpegSafePath("C:\\Fonts\\My Font[wdth,wght].ttf");
  assert.equal(out, "C\\:/Fonts/My\\ Font\\[wdth,wght\\].ttf");
});
