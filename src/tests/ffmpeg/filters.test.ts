import test from "node:test";
import assert from "node:assert/strict";

import { toFFPath, buildDrawText } from "../../ffmpeg/filters";

test("toFFPath converts Windows paths", () => {
  const win = "C:/foo/bar".replace(/\//g, "\\");
  assert.equal(toFFPath(win), "C\\:/foo/bar");
});

test("buildDrawText renders inline text", () => {
  const chain = buildDrawText({
    label: "t0",
    text: "ciao",
    fontFile: "/tmp/font.ttf",
    fontSize: 20,
    fontColor: "white",
    xExpr: "100",
    yExpr: "200",
  });
  assert.match(chain, /drawtext=/);
  assert.match(chain, /ciao/);
});

