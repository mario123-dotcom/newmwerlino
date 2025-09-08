import test from "node:test";
import assert from "node:assert/strict";

import { getTextBoxFromTemplate, getLogoBoxFromTemplate, getFontFamilyFromTemplate, wrapText, buildTimelineFromLayout } from "../timeline";
import type { TemplateDoc } from "../template";
import { paths } from "../paths";

test("getTextBoxFromTemplate uses anchors and keeps box inside canvas", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "50%",
            y: "50%",
            width: "60%",
            height: "40%",
            x_anchor: "50%",
            y_anchor: "50%",
          },
        ],
      },
    ],
  };
  const box = getTextBoxFromTemplate(tpl, 0)!;
  assert.equal(box.x, 20);
  assert.equal(box.y, 30);
  assert.equal(box.w, 60);
  assert.equal(box.h, 40);
});

test("getTextBoxFromTemplate clamps to slide bounds", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "95%",
            y: "5%",
            width: "20%",
            height: "10%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
        ],
      },
    ],
  };
  const box = getTextBoxFromTemplate(tpl, 0)!;
  assert.equal(box.x, 80);
  assert.equal(box.y, 5);
});

test("getLogoBoxFromTemplate uses anchors and clamps", () => {
  const tpl: TemplateDoc = {
    width: 200,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "image",
            name: "Logo",
            x: "50%",
            y: "50%",
            width: "50%",
            height: "50%",
            x_anchor: "50%",
            y_anchor: "50%",
          },
        ],
      },
    ],
  };
  const box = getLogoBoxFromTemplate(tpl, 0)!;
  assert.equal(box.x, 50);
  assert.equal(box.y, 25);
  assert.equal(box.w, 100);
  assert.equal(box.h, 50);
});

test("getFontFamilyFromTemplate reads font family", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            font_family: "Roboto",
          },
        ],
      },
    ],
  };
  const fam = getFontFamilyFromTemplate(tpl, 0);
  assert.equal(fam, "Roboto");
});

test("wrapText splits by length", () => {
  const lines = wrapText("uno due tre quattro cinque", 7);
  assert.deepEqual(lines, ["uno due", "tre", "quattro", "cinque"]);
});

test("buildTimelineFromLayout extends slide and adds outro", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 2,
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "0%",
            y: "0%",
            width: "10%",
            height: "10%",
            x_anchor: "0%",
            y_anchor: "0%",
            font_family: "Roboto",
          },
          { type: "image", name: "Logo", x: "50%", y: "50%", width: "10%", height: "10%" },
        ],
      },
      {
        type: "composition",
        name: "Outro",
        duration: 1,
        elements: [
          { type: "text", name: "Testo-outro", x: "0%", y: "0%", font_family: "Roboto" },
          { type: "image", name: "Logo", x: "50%", y: "50%", width: "10%", height: "10%" },
        ],
      },
    ],
  } as any;
  const mods = { "TTS-0": "foo", "TTS-0.duration": 1 };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 100,
    videoH: 100,
    fps: 30,
    defaultDur: 2,
  });
  assert.equal(slides.length, 2); // slide + outro
  assert.equal(slides[0].durationSec, 2); // extended to slide duration
  assert.equal(slides[1].durationSec, 1); // outro
});
