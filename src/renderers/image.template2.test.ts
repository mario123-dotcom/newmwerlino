import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "fs";
import { FOOTER, TEXT } from "../config";

// Ensure template2 landscape places logo below text
test("template2 landscape logo below text", (t) => {
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
    }
  );
  unlinkSync("dummy_img.png");
  unlinkSync("dummy_logo.png");

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fchain = captured![idx + 1];
  const margin = Math.round(1920 * TEXT.LEFT_MARGIN_P);
  assert.ok(
    fchain.includes(
      `overlay=x=${margin}:y=H-h-${FOOTER.MARGIN_BOTTOM}`
    )
  );
});

