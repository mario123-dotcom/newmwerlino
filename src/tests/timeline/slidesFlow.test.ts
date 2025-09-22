import test from "node:test";
import assert from "node:assert/strict";

import { buildTimelineFromLayout } from "../../timeline";
import type { TemplateDoc } from "../../template";
import { paths } from "../../paths";

test("buildTimelineFromLayout includes filler slide and outro", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 2,
        elements: [
          { type: "text", name: "Testo-0", x: "0%", y: "0%", width: "10%", height: "10%", x_anchor: "0%", y_anchor: "0%", font_family: "Roboto" },
          { type: "image", name: "Logo", x: "50%", y: "50%", width: "10%", height: "10%" },
        ],
      },
      {
        type: "composition",
        name: "Slide_1",
        duration: 1,
        elements: [
          { type: "image", name: "Logo", x: "50%", y: "50%", width: "10%", height: "10%" },
        ],
      },
      {
        type: "composition",
        name: "Slide_2",
        duration: 2,
        elements: [
          { type: "text", name: "Testo-2", x: "0%", y: "0%", width: "10%", height: "10%", x_anchor: "0%", y_anchor: "0%", font_family: "Roboto" },
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
  const mods = { "TTS-0": "foo", "TTS-2": "bar" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 100,
    videoH: 100,
    fps: 30,
    defaultDur: 2,
  });
  assert.equal(slides.length, 4); // slide0 + filler1 + slide2 + outro
  assert.equal(slides[0].durationSec, 2);
  assert.equal(slides[1].ttsPath, undefined); // filler has no tts
  assert.equal(slides[1].durationSec, 1);
  assert.equal(slides[1].backgroundAnimated, false);
  assert.equal(slides[2].durationSec, 2);
  assert.equal(slides[3].durationSec, 1);
});

test("buildTimelineFromLayout reuses template logo position for gap filler", () => {
  const tpl: TemplateDoc = {
    width: 800,
    height: 600,
    elements: [
      { type: "composition", name: "Slide_0", duration: 1, elements: [] },
      {
        type: "composition",
        name: "Slide_1",
        duration: 1,
        elements: [
          {
            type: "image",
            name: "Logo",
            x: "60%",
            y: "70%",
            width: "10%",
            height: "15%",
            x_anchor: "50%",
            y_anchor: "50%",
          },
          { type: "text", name: "Testo-1", x: "0%", y: "0%", width: "10%", height: "10%", x_anchor: "0%", y_anchor: "0%" },
        ],
      },
    ],
  } as any;

  const mods = {
    "Slide_0.time": "0 s",
    "Slide_1.time": "5 s",
    "Testo-1": "ciao",
  };

  const prevImages = paths.images;
  const prevTts = paths.tts;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  try {
    const slides = buildTimelineFromLayout(mods, tpl, {
      videoW: 800,
      videoH: 600,
      fps: 30,
      defaultDur: 1,
    });

    assert.equal(slides.length, 3);
    const filler = slides[1];
    assert.equal(filler.logoWidth, 80);
    assert.equal(filler.logoHeight, 90);
    assert.equal(filler.logoX, 440);
    assert.equal(filler.logoY, 375);
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
  }
});

test("buildTimelineFromLayout inserts gap filler and extends to TTS length", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      { type: "composition", name: "Slide_0", duration: 1, elements: [] },
      { type: "composition", name: "Slide_1", duration: 1, elements: [] },
    ],
  } as any;
  const mods = {
    "Slide_0.time": "0 s",
    "Slide_1.time": "5 s",
    "TTS-0": "foo",
    "TTS-0.duration": "3 s",
  };
  paths.tts = "/tmp";
  paths.images = "/tmp";
  const slides = buildTimelineFromLayout(mods, tpl, { videoW: 100, videoH: 100, fps: 30, defaultDur: 1 });
  assert.equal(slides.length, 3);
  assert.equal(slides[0].durationSec, 3);
  assert.equal(slides[1].durationSec, 2);
});

test("buildTimelineFromLayout honors response durations when inserting filler", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      { type: "composition", name: "Slide_0", duration: 10, elements: [] },
      { type: "composition", name: "Slide_1", duration: 1, elements: [] },
    ],
  } as any;
  const mods = {
    "Slide_0.time": "0 s",
    "Slide_0.duration": "3 s",
    "Slide_1.time": "5 s",
  };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 100,
    videoH: 100,
    fps: 30,
    defaultDur: 1,
  });
  assert.equal(slides.length, 3);
  assert.equal(slides[0].durationSec, 3);
  assert.equal(slides[1].durationSec, 2);
});

test("buildTimelineFromLayout skips slides marked invisible", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      { type: "composition", name: "Slide_0", duration: 1, elements: [] },
      { type: "composition", name: "Slide_1", duration: 1, elements: [] },
    ],
  } as any;
  const mods = { "Testo-0": "a", "Testo-1": "b", "Slide_1.visible": false };
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 100,
    videoH: 100,
    fps: 30,
    defaultDur: 1,
  });
  assert.equal(slides.length, 1);
});
