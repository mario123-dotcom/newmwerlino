import test from "node:test";
import assert from "node:assert/strict";
import { hydrateTemplate } from "./templateParser";

test("hydrateTemplate fills local paths and text", () => {
  const tpl = hydrateTemplate({ "Testo-0": "Hello" });

  const audio = tpl.audios.find((a) => a.name === "TTS-0");
  assert.ok(audio && audio.source.includes("tts-0"));

  const first = tpl.compositions[0];
  const img = first.elements.find((e: any) => e.name === "Immagine-0") as any;
  assert.ok(img && /img0\./.test(img.source));

  const txt = first.elements.find((e: any) => e.name === "Testo-0") as any;
  assert.equal(txt?.text, "Hello");
});

