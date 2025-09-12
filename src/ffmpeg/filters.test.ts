import test from "node:test";
import assert from "node:assert/strict";

import { toFFPath, buildDrawText } from "./filters";

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

test("buildDrawText supports shadow options", () => {
  const chain = buildDrawText({
    label: "t1",
    text: "hi",
    fontFile: "/tmp/font.ttf",
    fontSize: 20,
    fontColor: "white",
    xExpr: "0",
    yExpr: "0",
    shadowColor: "#000000",
    shadowAlpha: 0.5,
    shadowX: 2,
    shadowY: 2,
  });
  assert.match(chain, /shadowcolor/);
  assert.match(chain, /shadowx=2/);
});

