import test from "node:test";
import assert from "node:assert/strict";

// capture ffmpeg args

test("render text element builds drawtext filter", (t) => {
  let captured: string[] | undefined;
  const runMod = require("../ffmpeg/run");
  t.mock.method(runMod, "runFFmpeg", (args: string[]) => { captured = args; });

  const { renderTemplateElement } = require("./templateObject");
  renderTemplateElement(
    { type: "text", text: "hello", x: "10%", y: "20%", height: "10%", fill_color: "red" },
    1,
    "out.mp4",
    { fps: 30, videoW: 1920, videoH: 1080, fontPath: "font.ttf" }
  );

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fc = captured![idx + 1];
  assert.ok(fc.includes("drawtext"));
  assert.ok(fc.includes("fontcolor=red"));
});
