import test from "node:test";
import assert from "node:assert/strict";
import { parseTemplateHorizontal } from "./templateParser";

test("parseTemplateHorizontal extracts audio and slide info", () => {
  const tpl = parseTemplateHorizontal();
  assert.ok(tpl.audios.length > 0);
  const firstAudio = tpl.audios[0];
  assert.equal(firstAudio.volume, "0%");
  assert.ok(typeof firstAudio.source === "string");

  assert.ok(tpl.compositions.length > 0);
  const firstComp = tpl.compositions[0];
  assert.ok(firstComp.duration > 0);
  const shape = firstComp.elements.find((e) => e.type === "shape") as any;
  assert.ok(shape);
  if (shape) assert.equal(shape.fill_color, "#ff1878");
  const text = firstComp.elements.find((e) => e.type === "text") as any;
  assert.ok(text);
  if (text) assert.ok(typeof text.text === "string" && text.text.length > 0);
});
