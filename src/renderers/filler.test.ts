import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "fs";
import { FOOTER } from "../config";

// Ensure filler centers the logo when present
test("filler centers logo", (t) => {
  let captured: string[] | undefined;
  const runMod = require("../ffmpeg/run");
  t.mock.method(runMod, "runFFmpeg", (args: string[]) => {
    captured = args;
  });

  // create dummy logo so existsSync returns true
  writeFileSync("dummy.png", "");
  const { renderFillerSegment } = require("./filler");
  renderFillerSegment(
    { duration: 1 },
    "out.mp4",
    {
      fps: 30,
      videoW: 1920,
      videoH: 1080,
      logoPath: "dummy.png",
      fillColor: "red",
    }
  );
  unlinkSync("dummy.png");

  assert.ok(captured);
  const idx = captured!.indexOf("-filter_complex");
  assert.notEqual(idx, -1);
  const fchain = captured![idx + 1];
  assert.equal(
    fchain,
    `[0:v]format=rgba[base];[2:v]scale=-1:${FOOTER.LOGO_HEIGHT},format=rgba[lg];[base][lg]overlay=x=(W-w)/2:y=(H-h)/2[v]`
  );
});


