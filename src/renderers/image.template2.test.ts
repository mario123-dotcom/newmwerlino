import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "fs";
import { TEXT } from "../config";


// Ensure template2 landscape places logo at top-left aligned with bar
test("template2 landscape logo top-left", (t) => {
  let captured: string[] | undefined;
  const runMod = require("../ffmpeg/run");
  t.mock.method(runMod, "runFFmpeg", (args: string[]) => {
    captured = args;
  });

  writeFileSync("dummy_img.png", "");
  writeFileSync("dummy_logo.png", "");
  const { renderImageSeg } = require("./image");
  renderImageSeg(
    { duration: 1, img: "dummy_img.png", text: "ciao" },
    "out.mp4",
    {
      fps: 30,
      videoW: 1920,
      videoH: 1080,
      fontPath: "font.ttf",
      logoPath: "dummy_logo.png",
      textTransition: "wiperight",
      shadeColor: "red",
      fillColor: "red",
      logoPosition: "top-left",
      barColor: "red",
    }
  );
  unlinkSync("dummy_img.png");
  unlinkSync("dummy_logo.png");

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fchain = captured![idx + 1];
  const margin = Math.round(1920 * TEXT.LEFT_MARGIN_P);
  const top = Math.round(1080 * TEXT.TOP_MARGIN_P.landscape);
  assert.ok(fchain.includes(`overlay=x=${margin}:y=${top}`));

});

