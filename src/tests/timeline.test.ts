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
  assert.equal(slides[2].durationSec, 2);
  assert.equal(slides[3].durationSec, 1);
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
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 100,
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

test("buildTimelineFromLayout marks animated background from template tags", () => {
  const tpl: TemplateDoc = {
    width: 1920,
    height: 1080,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 5,
        tags: ["background-animated"],
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "10%",
            y: "10%",
            width: "80%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
          {
            type: "image",
            name: "Logo",
            x: "90%",
            y: "90%",
            width: "10%",
            height: "10%",
            x_anchor: "100%",
            y_anchor: "100%",
          },
        ],
      },
    ],
  } as any;
  const mods = { "Testo-0": "demo" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 1920,
    videoH: 1080,
    fps: 30,
    defaultDur: 5,
  });

  assert.equal(slides.length, 1);
  assert.equal(slides[0].backgroundAnimated, true);
});

test("buildTimelineFromLayout reads animated background flags from modifications", () => {
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
            type: "text",
            name: "Testo-0",
            x: "10%",
            y: "10%",
            width: "80%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
          {
            type: "image",
            name: "Logo",
            x: "90%",
            y: "90%",
            width: "10%",
            height: "10%",
            x_anchor: "100%",
            y_anchor: "100%",
          },
        ],
      },
    ],
  } as any;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  const baseMods = { "Testo-0": "demo" };

  const slidesByFlag = buildTimelineFromLayout(
    { ...baseMods, "Slide_0.backgroundAnimated": true },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesByFlag[0].backgroundAnimated, true);

  const slidesByTags = buildTimelineFromLayout(
    { ...baseMods, "Slide_0.tags": "background animated" },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesByTags[0].backgroundAnimated, true);

  const slidesOverride = buildTimelineFromLayout(
    { ...baseMods, "Slide_0.tags": "background animated", "Slide_0.backgroundAnimated": "false" },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesOverride[0].backgroundAnimated, undefined);
});

test("buildTimelineFromLayout infers animated backgrounds from split background/zoom tags", () => {
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
            type: "text",
            name: "Testo-0",
            x: "10%",
            y: "10%",
            width: "80%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
        ],
      },
    ],
  } as any;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  const slidesFromCommaString = buildTimelineFromLayout(
    { "Testo-0": "demo", "Slide_0.tags": "background, zoom" },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesFromCommaString[0].backgroundAnimated, true);

  const slidesFromBooleanTags = buildTimelineFromLayout(
    {
      "Testo-0": "demo",
      "Slide_0.tags.background": true,
      "Slide_0.tags.zoom": true,
    },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesFromBooleanTags[0].backgroundAnimated, true);

  const slidesMissingZoom = buildTimelineFromLayout(
    { "Testo-0": "demo", "Slide_0.tags.background": true },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesMissingZoom[0].backgroundAnimated, undefined);
});

test("buildTimelineFromLayout recognises nested tag containers in modifications", () => {
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
            type: "text",
            name: "Testo-0",
            x: "10%",
            y: "10%",
            width: "80%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
        ],
      },
    ],
  } as any;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  const baseMods = { "Testo-0": "demo" };

  const slidesFromNestedTags = buildTimelineFromLayout(
    {
      ...baseMods,
      Slide_0: { metadata: { tags: { background: true, zoom: true } } },
    },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesFromNestedTags[0].backgroundAnimated, true);

  const slidesFromNestedArrays = buildTimelineFromLayout(
    {
      ...baseMods,
      Slide_0: { tags: ["background", { zoom: { animated: true } }] },
    },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesFromNestedArrays[0].backgroundAnimated, true);

  const slidesWithNestedFlag = buildTimelineFromLayout(
    {
      ...baseMods,
      Slide_0: { settings: { backgroundAnimated: "true" } },
    },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesWithNestedFlag[0].backgroundAnimated, true);

  const slidesWithNestedOverride = buildTimelineFromLayout(
    {
      ...baseMods,
      Slide_0: {
        metadata: { tags_background: { animated: true } },
        backgroundAnimated: false,
      },
    },
    tpl,
    { videoW: 1920, videoH: 1080, fps: 30, defaultDur: 5 }
  );
  assert.equal(slidesWithNestedOverride[0].backgroundAnimated, undefined);
});

test("buildTimelineFromLayout ignores fade-out animations", () => {
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
            animations: [
              { type: "fade", time: 0, duration: 0.5 },
              { type: "fade", time: "end", duration: 0.5, reversed: true },
            ],
          },
        ],
      },
    ],
  } as any;
  const mods = { "Testo-0": "hi" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, { videoW: 100, videoH: 100, fps: 30, defaultDur: 2 });
  const anims = slides[0].texts![0].animations!;
  assert.equal(anims.length, 1);
  assert.equal(anims[0].type, "fade");
  assert.equal(anims[0].time, 0);
});

test("buildTimelineFromLayout uses fixed wipe timings", () => {
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
            animations: [
              {
                type: "text-reveal",
                time: 5,
                duration: 5,
                split: "line",
                axis: "x",
                x_anchor: "100%",
              },
            ],
          },
        ],
      },
    ],
  } as any;
  const mods = { "Testo-0": "a b" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 100,
    videoH: 100,
    fps: 30,
    defaultDur: 2,
  });
  const t0 = slides[0].texts!;
  assert.equal(t0.length >= 2, true);
  assert.deepEqual(t0[0].animations, [
    { type: "wipe", time: 0, duration: 0.5, direction: "wipeleft" },
  ]);
  assert.deepEqual(t0[1].animations, [
    { type: "wipe", time: 0.5, duration: 0.5, direction: "wipeleft" },
  ]);
});
