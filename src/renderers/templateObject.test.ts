import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, existsSync } from "fs";


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
        x: "50%",
        y: "50%",
        width: "10%",
        height: "20%",
        x_anchor: "50%",
        y_anchor: "50%",

      },
      {
        type: "text",
        text: "hello",
        x: "10%",
        y: "20%",
        height: "10%",
        fill_color: "red",
        font_family: "Archivo",
      },
    ],
    1,
    "out.mp4",
    { fps: 30, videoW: 1920, videoH: 1080, fonts: { Archivo: "C:/fonts/font.ttf" } }
  );
  if (existsSync("dummy.png")) unlinkSync("dummy.png");


  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fc = captured![idx + 1];
  assert.ok(fc.includes("overlay"));
  assert.ok(fc.includes("drawtext"));
  assert.ok(fc.includes("scale=192:216"));
  assert.ok(fc.includes("fontfile='C\\:/fonts/font.ttf'"));
  assert.ok(fc.includes("overlay=x=864:y=432"));

});

test("image fit contain scales with aspect ratio", (t) => {
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
        width: "50%",
        height: "50%",
        fit: "contain",
        x: 0,
        y: 0,
      },
    ],
    1,
    "out.mp4",
    { fps: 30, videoW: 200, videoH: 100, fonts: {} }
  );
  unlinkSync("dummy.png");

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fchain = captured![idx + 1];
  assert.equal(
    fchain,
    `[1:v]scale=100:50:force_original_aspect_ratio=decrease,format=rgba,pad=100:50:(ow-iw)/2:(oh-ih)/2:color=black@0[s0];[0:v][s0]overlay=x=0:y=0[v1]`
  );
});

test("vmin units use smaller viewport dimension as percent", (t) => {
  let captured: string[] | undefined;
  const runMod = require("../ffmpeg/run");
  t.mock.method(runMod, "runFFmpeg", (args: string[]) => {
    captured = args;
  });

  const { renderTemplateSlide } = require("./templateObject");
  renderTemplateSlide(
    [
      {
        type: "text",
        text: "copy",
        shadow_color: "#000000",
        shadow_x: "1 vmin",
        shadow_y: "1 vmin",
        font_size_minimum: "1 vmin",
        font_size_maximum: "2 vmin",
        font_family: "Archivo",
      },
    ],
    1,
    "out.mp4",
    { fps: 30, videoW: 200, videoH: 100, fonts: { Archivo: "C:/fonts/font.ttf" } }
  );

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fc = captured![idx + 1];
  assert.ok(fc.includes("shadowx=1:shadowy=1"));
  assert.ok(fc.includes("fontsize=2"));
});

test("text includes letter spacing when specified", (t) => {
  let captured: string[] | undefined;
  const runMod = require("../ffmpeg/run");
  t.mock.method(runMod, "runFFmpeg", (args: string[]) => {
    captured = args;
  });

  const { renderTemplateSlide } = require("./templateObject");
  renderTemplateSlide(
    [
      {
        type: "text",
        text: "abc",
        letter_spacing: "200%",
        font_family: "Archivo",
      },
    ],
    1,
    "out.mp4",
    { fps: 30, videoW: 100, videoH: 100, fonts: { Archivo: "C:/fonts/font.ttf" } }
  );

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fc = captured![idx + 1];
  assert.ok(fc.includes(":spacing="));
});

test("pan animation escapes commas in ffmpeg expressions", (t) => {
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
        animations: [
          {
            type: "pan",
            time: 0,
            duration: 1,
            start_x: "0%",
            end_x: "100%",
            start_y: "0%",
            end_y: "0%",
            start_scale: "100%",
            end_scale: "120%",
          },
        ],
      },
    ],
    1,
    "out.mp4",
    { fps: 30, videoW: 100, videoH: 100, fonts: {} }
  );
  unlinkSync("dummy.png");

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fc = captured![idx + 1];
  assert.ok(fc.includes("min(max((t-0)/1\\,0)\\,1)"));
});
