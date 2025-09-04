import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "fs";

// capture ffmpeg args

test("renderTemplateSlide overlays image and text", (t) => {
  let captured: string[] | undefined;
  const runMod = require("../ffmpeg/run");
  t.mock.method(runMod, "runFFmpeg", (args: string[]) => {
    captured = args;
  });

  writeFileSync("dummy.png", "");
  const { renderTemplateSlide } = require("./templateObject");
  renderTemplateSlide(
    [
      {
        type: "image",
        file: "dummy.png",
        x: "0%",
        y: "0%",
        width: "10%",
        height: "20%",
      },
      {
        type: "text",
        text: "hello",
        x: "10%",
        y: "20%",
        height: "10%",
        fill_color: "red",
      },
    ],
    1,
    "out.mp4",
    { fps: 30, videoW: 1920, videoH: 1080, fontPath: "C:/fonts/font.ttf" }
  );
  unlinkSync("dummy.png");

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fc = captured![idx + 1];
  assert.ok(fc.includes("overlay"));
  assert.ok(fc.includes("drawtext"));
  assert.ok(fc.includes("scale=192:216"));
  assert.ok(fc.includes("fontfile='C:/fonts/font.ttf'"));
});
