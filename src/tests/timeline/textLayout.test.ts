import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

import {
  buildTimelineFromLayout,
  getTextBoxFromTemplate,
  wrapText,
  APPROX_CHAR_WIDTH_RATIO,
} from "../../timeline";
import { TEXT } from "../../config";
import type { TemplateDoc } from "../../template";
import { paths } from "../../paths";

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
    ...lines.map((ln) => ln.length * fontPx * APPROX_CHAR_WIDTH_RATIO),
    0
  );
  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;

  const free = box.w - textWidth;
  const expected = box.x + Math.round(Math.min(free, Math.max(0, free)));
  assert.equal(block!.x, expected);
});

test("buildTimelineFromLayout honors text_align keywords", () => {
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
            x: "25%",
            y: "30%",
            width: "50%",
            height: "20%",
            x_anchor: "0%",
            y_anchor: "0%",
            text_align: "center",
            font_size: 36,
            line_height: "100%",
          },
        ],
      },
    ],
  } as any;

  const slides = buildTimelineFromLayout({ "Testo-0": "NOTIZIA" }, tpl, {
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
    ...lines.map((ln) => ln.length * fontPx * APPROX_CHAR_WIDTH_RATIO),
    0
  );
  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;

  const free = box.w - textWidth;
  const expected = box.x + Math.round(Math.min(free, Math.max(0, free * 0.5)));
  assert.equal(block!.x, expected);
});

test("buildTimelineFromLayout applies template text color", () => {
  const tpl: TemplateDoc = {
    width: 640,
    height: 360,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 2,
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "10%",
            y: "20%",
            width: "60%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
            fill_color: "rgba(18, 52, 86, 0.5)",
            font_size: 40,
            line_height: "120%",
          },
        ],
      },
    ],
  } as any;

  const slides = buildTimelineFromLayout({ "Testo-0": "COLORE" }, tpl, {
    videoW: 640,
    videoH: 360,
    fps: 25,
    defaultDur: 2,
  });

  const slide = slides[0];
  assert.ok(slide);
  const block = slide.texts?.[0];
  assert.ok(block);
  assert.equal(block!.fontColor, "#123456@0.5");
});

test("buildTimelineFromLayout scales template font with widened boxes", () => {
  const tpl: TemplateDoc = {
    width: 800,
    height: 450,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 3,
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "12%",
            y: "18%",
            width: "32%",
            height: "60%",
            x_anchor: "0%",
            y_anchor: "0%",
            font_size: 40,
            line_height: "130%",
          },
        ],
      },
    ],
  } as any;

  const textValue =
    "Una serie di scosse ha colpito i Campi Flegrei culminando alle prime luci di lunedì";
  const slides = buildTimelineFromLayout({ "Testo-0": textValue }, tpl, {
    videoW: 800,
    videoH: 450,
    fps: 25,
    defaultDur: 3,
  });

  const slide = slides[0];
  assert.ok(slide);
  const block = slide.texts?.[0];
  assert.ok(block);
  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;

  const templateWidth = (tpl.width * 32) / 100;
  const expectedScale = box.w / templateWidth;
  assert(expectedScale > 1);
  assert(block!.fontSize !== undefined);
  const fontSize = block!.fontSize ?? 0;
  const templateFont = 40;
  assert(fontSize > templateFont);
  const maxScale = Math.min(
    expectedScale,
    typeof TEXT.MAX_FONT_SCALE === "number" && TEXT.MAX_FONT_SCALE > 0
      ? TEXT.MAX_FONT_SCALE
      : expectedScale
  );
  const maxExpected = Math.round(templateFont * maxScale);
  assert(fontSize <= maxExpected);

  assert.equal(block!.x, box.x);
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
            letter_spacing: "200%",
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
  const letterSpacingPx = (fontPx * 200) / 1000;
  const textWidth = Math.max(
    ...lines.map((ln) =>
      ln.length * fontPx * APPROX_CHAR_WIDTH_RATIO +
      Math.max(ln.length - 1, 0) * letterSpacingPx
    )
  );
  const available = 600 - textWidth;
  const offset = Math.round(Math.max(0, available) * 0.5);
  const clamped = Math.max(0, Math.min(Math.max(0, Math.floor(available)), offset));
  const expected = clamped;
  assert.equal(block!.x, expected);
});

test("buildTimelineFromLayout centers outro textbox and text", () => {
  const tpl: TemplateDoc = {
    width: 800,
    height: 600,
    elements: [
      {
        type: "composition",
        name: "Outro",
        duration: 3,
        elements: [
          {
            type: "text",
            name: "Testo-outro",
            x: "40%",
            y: "30%",
            width: "30%",
            height: "10%",
            x_anchor: "0%",
            y_anchor: "0%",
            x_alignment: "0%",
            line_height: "100%",
            background_color: "rgba(255, 255, 255, 1)",
            text: "ARRIVEDERCI",
          },
          {
            type: "image",
            name: "Logo",
            x: "50%",
            y: "60%",
            width: "20%",
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
  const tmpDir = mkdtempSync(join(process.cwd(), "timeline-outro-center-"));
  try {
    writeFileSync(join(tmpDir, "img0.jpg"), "");
    paths.images = tmpDir;
    paths.tts = tmpDir;

    const slides = buildTimelineFromLayout({ "Testo-outro": "ARRIVEDERCI" }, tpl, {
      videoW: 800,
      videoH: 600,
      fps: 30,
      defaultDur: 3,
    });

    const outro = slides[slides.length - 1];
    const block = outro.texts?.[0];
    assert.ok(block);
    assert.ok(block?.background);

    const bg = block!.background!;
    const expectedCenter = 800 / 2;
    const bgCenter = bg.x + bg.width / 2;
    assert.ok(Math.abs(bgCenter - expectedCenter) <= 1);

    assert.ok(block!.textFile);
    const rendered = readFileSync(block!.textFile!, "utf8");
    const lines = rendered.split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length > 0);
    const fontPx = block!.fontSize ?? 0;
    const textWidth = Math.max(
      ...lines.map((ln) => ln.length * fontPx * APPROX_CHAR_WIDTH_RATIO)
    );
    const textCenter = block!.x + textWidth / 2;
    assert.ok(Math.abs(textCenter - expectedCenter) <= 1);
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
    rmSync(tmpDir, { recursive: true, force: true });
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

  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;

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
    const expectedBgX = Math.max(0, box.x - pad);
    const expectedBgY = Math.max(0, box.y - pad);
    const expectedBgW = Math.min(1920 - expectedBgX, box.w + pad * 2);
    const expectedBgH = Math.min(1080 - expectedBgY, box.h + pad * 2);
    assert.equal(primary.background?.x, expectedBgX);
    assert.equal(primary.background?.y, expectedBgY);
    assert.equal(primary.background?.width, expectedBgW);
    assert.equal(primary.background?.height, expectedBgH);
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

test("buildTimelineFromLayout caps slide line length to configured maximum", () => {
  const tpl: TemplateDoc = {
    width: 1920,
    height: 1080,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        duration: 3,
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "37.5%",
            y: "92.3%",
            width: "54.2%",
            height: "42.7%",
            x_anchor: "52%",
            y_anchor: "122%",
            line_height: "200%",
            background_color: "rgba(0,0,0,1)",
          },
        ],
      },
    ],
  } as any;

  const prevImages = paths.images;
  const prevTts = paths.tts;
  const prevAudio = paths.audio;
  const prevFonts = paths.fonts;

  paths.images = "/tmp/no_img";
  paths.tts = "/tmp/no_tts";
  paths.audio = "/tmp/no_audio";
  paths.fonts = "/tmp/no_fonts";

  try {
    const text =
      "Terremoto oggi ai Campi Flegrei, nuova forte scossa di magnitudo 4";
    const slides = buildTimelineFromLayout({ "Testo-0": text }, tpl, {
      videoW: 1920,
      videoH: 1080,
      fps: 25,
      defaultDur: 3,
    });
    const main = slides[0];
    assert.ok(main);
    const lines = (main.texts ?? [])
      .map((block) =>
        block.textFile ? readFileSync(block.textFile, "utf8").trim() : block.text ?? ""
      )
      .filter(Boolean);
    assert.deepEqual(lines, [
      "Terremoto oggi ai Campi",
      "Flegrei, nuova forte",
      "scossa di magnitudo 4",
    ]);
  } finally {
    paths.images = prevImages;
    paths.tts = prevTts;
    paths.audio = prevAudio;
    paths.fonts = prevFonts;
  }
});
