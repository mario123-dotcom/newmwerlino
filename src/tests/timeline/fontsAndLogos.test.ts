import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

import {
  getLogoBoxFromTemplate,
  getFontFamilyFromTemplate,
  getTextBoxFromTemplate,
  buildTimelineFromLayout,
  wrapText,
  APPROX_CHAR_WIDTH_RATIO,
} from "../../timeline";
import { TEXT } from "../../config";
import type { TemplateDoc } from "../../template";
import { paths } from "../../paths";

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
  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;

  const fallbackFont = 24;
  const approxCharWidth = APPROX_CHAR_WIDTH_RATIO;
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
      slide.texts?.map((tb) => (tb.textFile ? readFileSync(tb.textFile, "utf8") : "")) ?? [];
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
