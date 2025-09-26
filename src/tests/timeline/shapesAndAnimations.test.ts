import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

import { buildTimelineFromLayout } from "../../timeline";
import type { TemplateDoc } from "../../template";
import { paths } from "../../paths";

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
  const mods = { "Testo-0": "a b c d e" };
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
    { type: "wipe", time: 0, duration: 0.8, direction: "wipeleft" },
  ]);
  assert.deepEqual(t0[1].animations, [
    { type: "wipe", time: 0.4, duration: 0.8, direction: "wipeleft" },
  ]);
});
