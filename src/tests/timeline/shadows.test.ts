import test from "node:test";
import assert from "node:assert/strict";

import { buildTimelineFromLayout } from "../../timeline";
import type { TemplateDoc } from "../../template";
import { paths } from "../../paths";

test("buildTimelineFromLayout parses slide shadow", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        shadow_color: "rgba(0,0,0,0.5)",
        shadow_x: "10px",
        shadow_y: "20px",
        duration: 1,
        elements: [
          { type: "text", name: "Testo-0", x: "0%", y: "0%", width: "10%", height: "10%", x_anchor: "0%", y_anchor: "0%" },
        ],
      },
    ],
  } as any;
  const mods = { "Testo-0": "hello" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, { videoW: 100, videoH: 100, fps: 30, defaultDur: 1 });
  const s0 = slides[0];
  assert.equal(s0.shadowEnabled, true);
  assert.equal(s0.shadowColor, undefined);
  assert.equal(s0.shadowAlpha, undefined);
  assert.equal(s0.shadowW, undefined);
  assert.equal(s0.shadowH, undefined);
});

test("buildTimelineFromLayout reads nested background shadow metadata", () => {
  const tpl: TemplateDoc = {
    width: 200,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Wrapper",
        elements: [
          {
            type: "composition",
            name: "Slide_0",
            duration: 1,
            elements: [
              {
                type: "composition",
                name: "BackgroundGroup",
                elements: [
                  {
                    type: "image",
                    name: "Immagine-0",
                    shadow_color: "rgba(10,20,30,0.75)",
                    shadow_x: "50px",
                    shadow_y: "25px",
                  },
                ],
              },
              {
                type: "composition",
                name: "TextGroup",
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
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as any;
  const mods = { "Testo-0": "ombra" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 200,
    videoH: 100,
    fps: 30,
    defaultDur: 1,
  });
  assert.equal(slides.length, 1);
  const s0 = slides[0];
  assert.equal(s0.shadowEnabled, true);
  assert.equal(s0.shadowColor, undefined);
  assert.equal(s0.shadowAlpha, undefined);
  assert.equal(s0.shadowW, undefined);
  assert.equal(s0.shadowH, undefined);
});

test("buildTimelineFromLayout reads shadow overrides from modifications", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 1,
        elements: [
          { type: "text", name: "Testo-0", x: "0%", y: "0%", width: "10%", height: "10%", x_anchor: "0%", y_anchor: "0%" },
        ],
      },
    ],
  } as any;
  const mods = {
    "Testo-0": "ombra",
    "Slide_0.shadow_color": "rgba(10, 20, 30, 0.6)",
    "Slide_0.shadow_x": "50",
    "Slide_0.shadow_y": "25",
  };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, { videoW: 100, videoH: 100, fps: 30, defaultDur: 1 });
  const s0 = slides[0];
  assert.equal(s0.shadowEnabled, true);
  assert.equal(s0.shadowColor, undefined);
  assert.equal(s0.shadowAlpha, undefined);
  assert.equal(s0.shadowW, undefined);
  assert.equal(s0.shadowH, undefined);
});

test("buildTimelineFromLayout detects gradient background shapes as shadows", () => {
  const tpl: TemplateDoc = {
    width: 1920,
    height: 1080,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 5,
        elements: [
          {
            type: "shape",
            name: "Shape-gradient",
            width: "100%",
            height: "100%",
            fill_color: [
              { offset: "0%", color: "rgba(0,0,0,0)" },
              { offset: "100%", color: "#000000" },
            ],
          } as any,
        ],
      },
      { type: "composition", name: "Slide_1", duration: 5, elements: [] },
    ],
  } as any;
  const mods = {
    "Testo-0": "ombra",
    "Testo-1": "no ombra",
    "Slide_0.time": "0 s",
    "Slide_1.time": "5 s",
  };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 1920,
    videoH: 1080,
    fps: 30,
    defaultDur: 5,
  });
  assert.ok(slides.length >= 2);
  const s0 = slides[0];
  assert.equal(s0.shadowEnabled, true);
  assert.equal(s0.shadowColor, undefined);
  assert.equal(s0.shadowW, undefined);
  assert.equal(s0.shadowH, undefined);
  const s1 = slides[1];
  assert.equal(s1.shadowEnabled, undefined);
});

test("buildTimelineFromLayout marks slide shadow when only blur is provided", () => {
  const tpl: TemplateDoc = {
    width: 1920,
    height: 1080,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 5,
        elements: [
          {
            type: "image",
            name: "Immagine-0",
            shadow_blur: "1 vmin",
          } as any,
        ],
      },
    ],
  } as any;
  const mods = { "Testo-0": "ombra" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 1920,
    videoH: 1080,
    fps: 30,
    defaultDur: 5,
  });
  assert.ok(slides.length >= 1);
  const s0 = slides[0];
  assert.equal(s0.shadowEnabled, true);
});

test("buildTimelineFromLayout honours boolean shadow modifications", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      { type: "composition", name: "Slide_0", duration: 1, elements: [] },
    ],
  } as any;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  const slidesWithShadow = buildTimelineFromLayout(
    { "Testo-0": "ombra", "Slide_0.shadowEnabled": true },
    tpl,
    { videoW: 100, videoH: 100, fps: 30, defaultDur: 1 }
  );
  assert.equal(slidesWithShadow[0].shadowEnabled, true);

  const slidesNoShadow = buildTimelineFromLayout(
    { "Testo-0": "ombra", "Slide_0.shadowEnabled": false },
    tpl,
    { videoW: 100, videoH: 100, fps: 30, defaultDur: 1 }
  );
  assert.equal(slidesNoShadow[0].shadowEnabled, undefined);

  const slidesStringFalse = buildTimelineFromLayout(
    { "Testo-0": "ombra", "Slide_0.shadowEnabled": "false" },
    tpl,
    { videoW: 100, videoH: 100, fps: 30, defaultDur: 1 }
  );
  assert.equal(slidesStringFalse[0].shadowEnabled, undefined);
});
