import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

import {
  buildTimelineFromLayout,
  getLogoBoxFromTemplate,
  getTextBoxFromTemplate,
  wrapText,
  APPROX_CHAR_WIDTH_RATIO,
} from "../../timeline";
import { TEXT } from "../../config";
import type { TemplateDoc } from "../../template";
import { paths } from "../../paths";

function formatNumberForExpr(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10000) / 10000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function buildExpectedXExpr(
  box: { x: number; w: number },
  align: number,
  maxWidth: number
): string {
  const safeAlign = Math.max(0, Math.min(1, align));
  const safeWidth = maxWidth > 0 ? maxWidth : 0;
  const anchor =
    box.w > 0
      ? box.x + box.w * safeAlign
      : safeWidth > 0
      ? box.x + safeWidth * safeAlign
      : box.x;
  const maxAllowedExpr = `max(0,${formatNumberForExpr(safeWidth)}-text_w)`;
  const desiredExpr = `${formatNumberForExpr(anchor)}-text_w*${formatNumberForExpr(safeAlign)}`;
  return `max(0,min(${maxAllowedExpr},${desiredExpr}))`;
}

function computeCenteredOutroBox(
  tpl: TemplateDoc,
  videoW: number
): { x: number; y: number; w: number; h: number } {
  const rawBox =
    getTextBoxFromTemplate(tpl, "Outro", "Testo-outro", { preserveAnchor: true }) ??
    ({ x: 0, y: 0, w: 0, h: 0 } as const);
  if (!(rawBox.w > 0) || !(videoW > 0)) {
    return rawBox;
  }
  const logoBox = getLogoBoxFromTemplate(tpl, "Outro");
  let centerTarget: number | undefined;
  if (typeof logoBox.x === "number" && typeof logoBox.w === "number") {
    centerTarget = logoBox.x + logoBox.w / 2;
  } else {
    centerTarget = videoW / 2;
  }
  if (!Number.isFinite(centerTarget)) {
    return rawBox;
  }
  const desiredLeft = Math.round(centerTarget - rawBox.w / 2);
  const maxLeft = Math.max(0, videoW - rawBox.w);
  const safeLeft = Math.max(0, Math.min(maxLeft, desiredLeft));
  if (safeLeft === rawBox.x) {
    return rawBox;
  }
  return { ...rawBox, x: safeLeft };
}

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

  const videoW = 400;
  const slides = buildTimelineFromLayout({ "Testo-0": "CIAO" }, tpl, {
    videoW,
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

  const slideWidth = slide.width ?? tpl.width ?? 0;
  const align = 1;
  let desired = box.x + box.w * align - textWidth * align;
  if (slideWidth > 0) {
    const maxX = Math.max(0, Math.floor(slideWidth - textWidth));
    if (desired > maxX) desired = maxX;
    if (desired < 0) desired = 0;
  }
  const expected = Math.round(desired);
  assert.equal(block!.x, expected);
  const expectedExpr = buildExpectedXExpr(box, align, videoW);
  assert.equal(block!.xExpr, expectedExpr);
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

  const videoW = 400;
  const slides = buildTimelineFromLayout({ "Testo-0": "NOTIZIA" }, tpl, {
    videoW,
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

  const slideWidth = slide.width ?? tpl.width ?? 0;
  const align = 0.5;
  let desired = box.x + box.w * align - textWidth * align;
  if (slideWidth > 0) {
    const maxX = Math.max(0, Math.floor(slideWidth - textWidth));
    if (desired > maxX) desired = maxX;
    if (desired < 0) desired = 0;
  }
  const expected = Math.round(desired);
  assert.equal(block!.x, expected);
  const expectedExpr = buildExpectedXExpr(box, align, videoW);
  assert.equal(block!.xExpr, expectedExpr);
});

test("buildTimelineFromLayout centers text when x_alignment is percentage", () => {
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
            x: "20%",
            y: "25%",
            width: "25%",
            height: "20%",
            x_anchor: "0%",
            y_anchor: "0%",
            x_alignment: "50%",
            font_size: 36,
            line_height: "100%",
          },
        ],
      },
    ],
  } as any;

  const videoW = 400;
  const slides = buildTimelineFromLayout({ "Testo-0": "TESTO ALLINEATO AL CENTRO" }, tpl, {
    videoW,
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

  const slideWidth = slide.width ?? tpl.width ?? 0;
  const align = 0.5;
  let desired = box.x + box.w * align - textWidth * align;
  if (slideWidth > 0) {
    const maxX = Math.max(0, Math.floor(slideWidth - textWidth));
    if (desired > maxX) desired = maxX;
    if (desired < 0) desired = 0;
  }
  const expected = Math.round(desired);
  assert.equal(block!.x, expected);
  const expectedExpr = buildExpectedXExpr(box, align, videoW);
  assert.equal(block!.xExpr, expectedExpr);
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

  const videoW = 600;
  const slides = buildTimelineFromLayout(
    { "Testo-0": "ciao", "Testo-outro": "HELLO" },
    tpl,
    {
      videoW,
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
  const outroBox = getTextBoxFromTemplate(tpl, "Outro", "Testo-outro", {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;
  const outroWidth = outro.width ?? 600;
  const align = 0.5;
  let desired = outroBox.x + outroBox.w * align - textWidth * align;
  if (outroWidth > 0) {
    const maxX = Math.max(0, Math.floor(outroWidth - textWidth));
    if (desired > maxX) desired = maxX;
    if (desired < 0) desired = 0;
  }
  const expected = Math.round(desired);
  assert.equal(block!.x, expected);
  const expectedExpr = buildExpectedXExpr(outroBox, align, videoW);
  assert.equal(block!.xExpr, expectedExpr);
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
    const outroBox = computeCenteredOutroBox(tpl, 800);
    const expectedExpr = buildExpectedXExpr(outroBox, 0.5, 800);
    assert.equal(block!.xExpr, expectedExpr);

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
