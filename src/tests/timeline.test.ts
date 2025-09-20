import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

import {
  getTextBoxFromTemplate,
  getLogoBoxFromTemplate,
  getFontFamilyFromTemplate,
  wrapText,
  buildTimelineFromLayout,
  APPROX_CHAR_WIDTH_RATIO,
} from "../timeline";
import { TEXT } from "../config";
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
  assert.equal(box.x, 15);
  assert.equal(box.y, 27);
  assert.equal(box.w, 70);
  assert.equal(box.h, 47);
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
  assert.equal(box.x, 76);
  assert.equal(box.y, 5);
});

test("buildTimelineFromLayout aligns text horizontally inside box", () => {
  const tpl: TemplateDoc = {
    width: 400,
    height: 200,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 2,
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "50%",
            y: "25%",
            width: "50%",
            height: "20%",
            x_anchor: "0%",
            y_anchor: "0%",
            x_alignment: "100%",
            font_size: 40,
            line_height: "100%",
          },
        ],
      },
    ],
  } as any;

  const slides = buildTimelineFromLayout({ "Testo-0": "CIAO" }, tpl, {
    videoW: 400,
    videoH: 200,
    fps: 25,
    defaultDur: 2,
  });

  const slide = slides[0];
  const block = slide.texts?.[0];
  assert.ok(block);
  assert.ok(block?.textFile);
  const rendered = readFileSync(block!.textFile!, "utf8");
  const lines = rendered.split(/\r?\n/);
  const fontPx = block!.fontSize ?? 0;
  const textWidth = Math.max(
    ...lines.map((ln) => ln.length * fontPx * APPROX_CHAR_WIDTH_RATIO)
  );
  const box = getTextBoxFromTemplate(tpl, 0)!;
  const expected = Math.round(box.x + (box.w - textWidth));
  assert.equal(block!.x, expected);
});

test("buildTimelineFromLayout centers outro point text", () => {
  const tpl: TemplateDoc = {
    width: 600,
    height: 400,
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
            font_size: 30,
            line_height: "100%",
          },
        ],
      },
      {
        type: "composition",
        name: "Outro",
        duration: 2,
        elements: [
          {
            type: "text",
            name: "Testo-outro",
            x: "0%",
            y: "0%",
            x_anchor: "0%",
            y_anchor: "0%",
            x_alignment: "50%",
            font_size: 50,
            line_height: "100%",
            text: "HELLO",
          },
        ],
      },
    ],
  } as any;

  const slides = buildTimelineFromLayout(
    { "Testo-0": "ciao", "Testo-outro": "HELLO" },
    tpl,
    {
      videoW: 600,
      videoH: 400,
      fps: 25,
      defaultDur: 2,
    }
  );

  const outro = slides[slides.length - 1];
  const block = outro.texts?.[0];
  assert.ok(block);
  assert.ok(block?.textFile);
  const rendered = readFileSync(block!.textFile!, "utf8");
  const lines = rendered.split(/\r?\n/);
  const fontPx = block!.fontSize ?? 0;
  const textWidth = Math.max(
    ...lines.map((ln) => ln.length * fontPx * APPROX_CHAR_WIDTH_RATIO)
  );
  const expected = Math.round((600 - textWidth) / 2);
  assert.equal(block!.x, expected);
});

test("buildTimelineFromLayout centers outro text within template box", () => {
  const tpl: TemplateDoc = {
    width: 600,
    height: 400,
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
            font_size: 30,
            line_height: "100%",
          },
        ],
      },
      {
        type: "composition",
        name: "Outro",
        duration: 2,
        elements: [
          {
            type: "text",
            name: "Testo-outro",
            x: "50%",
            y: "10%",
            width: "5%",
            x_anchor: "50%",
            y_anchor: "0%",
            x_alignment: "50%",
            font_size: 70,
            line_height: "100%",
            text: "OUTRO",
          },
        ],
      },
    ],
  } as any;

  const slides = buildTimelineFromLayout(
    { "Testo-0": "ciao", "Testo-outro": "OUTRO" },
    tpl,
    {
      videoW: 600,
      videoH: 400,
      fps: 25,
      defaultDur: 2,
    }
  );

  const outro = slides[slides.length - 1];
  const block = outro.texts?.[0];
  assert.ok(block);
  assert.ok(block?.textFile);
  const rendered = readFileSync(block!.textFile!, "utf8");
  const lines = rendered.split(/\r?\n/);
  const fontPx = block!.fontSize ?? 0;
  const textWidth = Math.max(
    ...lines.map((ln) => ln.length * fontPx * APPROX_CHAR_WIDTH_RATIO)
  );
  const box = getTextBoxFromTemplate(tpl, "Outro", "Testo-outro")!;
  const center = box.x + box.w * 0.5;
  const expected = Math.round(center - textWidth * 0.5);
  assert.equal(block!.x, expected);
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

test("buildTimelineFromLayout assigns downloaded font file", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 1,
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
            font_family: "Noto Sans",
          },
          { type: "image", name: "Logo", x: "0%", y: "0%", width: "10%", height: "10%" },
        ],
      },
    ],
  } as any;

  const oldFonts = paths.fonts;
  const tmpFonts = mkdtempSync(join(process.cwd(), "fonts-test-"));
  const fontPath = join(tmpFonts, "notosans.ttf");
  writeFileSync(fontPath, "dummy");

  paths.fonts = tmpFonts;
  const prevImages = paths.images;
  const prevTts = paths.tts;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  try {
    const slides = buildTimelineFromLayout({ "Testo-0": "Ciao" }, tpl, {
      videoW: 100,
      videoH: 100,
      fps: 25,
      defaultDur: 1,
    });
    assert.equal(slides[0]?.fontFile, fontPath);
  } finally {
    paths.fonts = oldFonts;
    paths.images = prevImages;
    paths.tts = prevTts;
    rmSync(tmpFonts, { recursive: true, force: true });
  }
});

test("buildTimelineFromLayout stabilizes font after single-line fallback", () => {
  const tpl: TemplateDoc = {
    width: 1920,
    height: 1080,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 1,
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "0%",
            y: "0%",
            width: "80%",
            height: "60%",
            x_anchor: "0%",
            y_anchor: "0%",
            line_height: "135%",
          },
        ],
      },
    ],
  } as any;

  const text = "Ciao mondo meraviglioso";
  const box = getTextBoxFromTemplate(tpl, 0)!;
  const fallbackFont = 24;
  const approxCharWidth = 0.56;
  const fallbackMaxChars = Math.floor(box.w / (fallbackFont * approxCharWidth));
  const fallbackLayout = wrapText(text, fallbackMaxChars);
  assert.equal(fallbackLayout.length, 1);

  const prevImages = paths.images;
  const prevTts = paths.tts;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  try {
    const slides = buildTimelineFromLayout({ "Testo-0": text }, tpl, {
      videoW: 1920,
      videoH: 1080,
      fps: 25,
      defaultDur: 1,
    });
    const slide = slides[0];
    assert.ok(slide);
    const block = slide.texts?.[0];
    assert.ok(block);
    const linesCount = slide.texts?.length ?? 0;
    assert(linesCount >= 1);

    const lineHeightFactor = 1.35;
    const expectedFont = Math.round((box.h / linesCount) / lineHeightFactor);
    assert(block.fontSize <= expectedFont);

    const maxSingleLineFont = Math.round(box.h / lineHeightFactor);
    assert(block.fontSize < maxSingleLineFont);

    const lineStrings =
      slide.texts?.map((tb) =>
        tb.textFile ? readFileSync(tb.textFile, "utf8") : ""
      ) ?? [];
    const longest = lineStrings.reduce((max, line) => Math.max(max, line.length), 0);
    if (longest > 0) {
      const widthLimit = Math.floor(box.w / (longest * approxCharWidth));
      assert(block.fontSize <= widthLimit);
    }
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
  }
});

test("buildTimelineFromLayout adds extra padding to intro background", () => {
  const tpl: TemplateDoc = {
    width: 1920,
    height: 1080,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 2,
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "40%",
            y: "90%",
            width: "50%",
            height: "40%",
            x_anchor: "50%",
            y_anchor: "100%",
            line_height: "200%",
            background_color: "rgba(0,0,0,0.8)",
            font_family: "Archivo",
          },
          { type: "image", name: "Logo", x: "0%", y: "0%", width: "10%", height: "10%" },
        ],
      },
    ],
  } as any;

  const box = getTextBoxFromTemplate(tpl, 0)!;
  const prevImages = paths.images;
  const prevTts = paths.tts;
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";

  try {
    const slides = buildTimelineFromLayout({ "Testo-0": "Linea uno linea due" }, tpl, {
      videoW: 1920,
      videoH: 1080,
      fps: 25,
      defaultDur: 2,
    });
    const first = slides[0];
    assert.ok(first);
    const blocks = first.texts ?? [];
    assert(blocks.length > 0);
    const primary = blocks[0];
    assert.ok(primary.background);
    const pad = Math.round((primary.fontSize ?? 0) * TEXT.BOX_PAD_FACTOR);
    assert.ok(pad > 0);
    assert.equal(primary.background?.x, box.x - pad);
    assert.equal(primary.background?.y, box.y - pad);
    assert.equal(primary.background?.width, box.w + pad * 2);
    assert.equal(primary.background?.height, box.h + pad * 2);
    assert.equal(primary.background?.color, "#000000");
    assert.equal(primary.background?.alpha, 0.8);
    assert.equal(primary.box, true);
    assert.equal(primary.boxColor, "#000000");
    assert.equal(primary.boxAlpha, 0.8);
    assert.equal(primary.boxBorderW, pad);
    for (let idx = 1; idx < blocks.length; idx++) {
      assert.equal(blocks[idx].background, undefined);
    }
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
  }
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
  assert.equal(slides[1].backgroundAnimated, false);
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

test("buildTimelineFromLayout extracts wipe shapes from template", () => {
  const tpl: TemplateDoc = {
    width: 200,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 2,
        elements: [
          { type: "shape", width: "100%", height: "100%", fill_color: "#111" } as any,
          {
            type: "shape",
            x: "40%",
            y: "30%",
            width: "10%",
            height: "20%",
            x_anchor: "50%",
            y_anchor: "50%",
            fill_color: "#ff0000",
            animations: [
              { type: "wipe", time: 0, duration: "1 s", start_angle: "90°" },
            ],
          } as any,
          { type: "text", name: "Testo-0", x: "0%", y: "0%", width: "10%", height: "10%" } as any,
        ],
      },
    ],
  } as any;
  const mods = { "Testo-0": "ciao" };
  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 200,
    videoH: 100,
    fps: 30,
    defaultDur: 2,
  });
  assert.equal(slides.length, 1);
  const shape = slides[0].shapes?.[0];
  assert.ok(shape);
  assert.equal(shape?.color, "#ff0000");
  assert.equal(shape?.alpha, 1);
  assert.equal(shape?.width, 20);
  assert.equal(shape?.height, 20);
  assert.equal(shape?.x, 70);
  assert.equal(shape?.y, 20);
  assert.ok(shape?.animations && shape.animations.length === 1);
  const anim = shape!.animations![0];
  if (anim.type !== "wipe") {
    throw new Error(`expected wipe animation, got ${anim.type}`);
  }
  assert.equal(anim.duration, 1);
  assert.equal(anim.time, 0);
  assert.equal(anim.direction, "wipeup");
});

test("buildTimelineFromLayout animates backgrounds after the first slide", () => {
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
      {
        type: "composition",
        name: "Slide_1",
        duration: 5,
        elements: [
          {
            type: "text",
            name: "Testo-1",
            x: "10%",
            y: "60%",
            width: "80%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
        ],
      },
    ],
  } as any;
  const prevImages = paths.images;
  const prevTts = paths.tts;
  const tmpDir = mkdtempSync(join(process.cwd(), "timeline-bg-"));
  try {
    writeFileSync(join(tmpDir, "img0.jpg"), "");
    writeFileSync(join(tmpDir, "img1.jpg"), "");
    paths.images = tmpDir;
    paths.tts = tmpDir;

    const slides = buildTimelineFromLayout(
      { "Testo-0": "ciao", "Testo-1": "ciao" },
      tpl,
      {
        videoW: 1920,
        videoH: 1080,
        fps: 30,
        defaultDur: 5,
      }
    );

    assert.equal(slides.length, 2);
    assert.equal(slides[0].backgroundAnimated, undefined);
    assert.equal(slides[1].backgroundAnimated, true);
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("buildTimelineFromLayout keeps outro background static", () => {
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
      {
        type: "composition",
        name: "Outro",
        duration: 3,
        elements: [
          {
            type: "text",
            name: "Testo-outro",
            x: "50%",
            y: "50%",
            width: "80%",
            height: "20%",
            x_anchor: "50%",
            y_anchor: "50%",
          },
        ],
      },
    ],
  } as any;
  const prevImages = paths.images;
  const prevTts = paths.tts;
  const tmpDir = mkdtempSync(join(process.cwd(), "timeline-outro-"));
  try {
    writeFileSync(join(tmpDir, "img0.jpg"), "");
    paths.images = tmpDir;
    paths.tts = tmpDir;

    const slides = buildTimelineFromLayout({ "Testo-0": "ciao" }, tpl, {
      videoW: 1920,
      videoH: 1080,
      fps: 30,
      defaultDur: 5,
    });

    assert.ok(slides.length >= 2);
    assert.equal(slides[0].backgroundAnimated, undefined);
    const outro = slides[slides.length - 1];
    assert.equal(outro.backgroundAnimated, undefined);
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("buildTimelineFromLayout animates every non-intro, non-filler slide", () => {
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
      {
        type: "composition",
        name: "Slide_1",
        duration: 5,
        elements: [
          {
            type: "text",
            name: "Testo-1",
            x: "10%",
            y: "10%",
            width: "80%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
        ],
      },
      {
        type: "composition",
        name: "Slide_2",
        duration: 5,
        elements: [
          {
            type: "text",
            name: "Testo-2",
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

  const prevImages = paths.images;
  const prevTts = paths.tts;
  const tmpDir = mkdtempSync(join(process.cwd(), "timeline-bg-default-"));
  try {
    writeFileSync(join(tmpDir, "img0.jpg"), "");
    writeFileSync(join(tmpDir, "img1.jpg"), "");
    writeFileSync(join(tmpDir, "img2.jpg"), "");
    paths.images = tmpDir;
    paths.tts = tmpDir;

    const slides = buildTimelineFromLayout(
      {
        "Testo-0": "uno",
        "Testo-2": "tre",
      },
      tpl,
      {
        videoW: 1920,
        videoH: 1080,
        fps: 30,
        defaultDur: 5,
      }
    );

    assert.equal(slides.length, 3);
    assert.equal(slides[0].backgroundAnimated, undefined);
    assert.equal(slides[1].backgroundAnimated, false);
    assert.equal(slides[2].backgroundAnimated, true);
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
    rmSync(tmpDir, { recursive: true, force: true });
  }
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
  const slides = buildTimelineFromLayout(mods, tpl, {
    videoW: 100,
    videoH: 100,
    fps: 30,
    defaultDur: 2,
  });
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
