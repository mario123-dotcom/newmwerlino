import { TEXT } from "../../config";
import { findComposition, type TemplateDoc } from "../../template";
import { parseSec } from "../utils";
import type { SlideSpec } from "../types";
import { buildStandardSlide } from "./standardSlide";
import { buildOutroSegment } from "./outroSlide";
import { createGapSlide } from "./gapSlide";
import { findImageForSlide, findTTSForSlide } from "../assets";

function resolveTemplateWidth(template: TemplateDoc, fallback: number): number {
  const { width } = template;
  return typeof width === "number" && Number.isFinite(width) && width > 0 ? width : fallback;
}

function resolveSlideMaxChars(): number | undefined {
  const raw = TEXT.MAX_CHARS_PER_LINE;
  return typeof raw === "number" && raw > 0 ? raw : undefined;
}

function isVisibleFlag(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return !(normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off");
  }
  return true;
}

function detectLastSlideIndex(mods: Record<string, any>): number {
  let maxIdx = -1;
  const slideTimeRe = /^Slide_(\d+)\.time$/;
  for (const key of Object.keys(mods)) {
    const match = key.match(slideTimeRe);
    if (match) {
      maxIdx = Math.max(maxIdx, Number(match[1]));
    }
  }
  for (let i = 0; i < 50; i++) {
    const hasText = typeof mods[`Testo-${i}`] === "string" && mods[`Testo-${i}`].trim() !== "";
    const hasTTS = !!mods[`TTS-${i}`] || !!findTTSForSlide(i);
    const hasImg = !!mods[`Immagine-${i}`] || !!findImageForSlide(i);
    if (hasText || hasTTS || hasImg) {
      maxIdx = Math.max(maxIdx, i);
    }
  }
  return maxIdx;
}

export function buildTimelineFromLayout(
  modifications: Record<string, any>,
  template: TemplateDoc,
  opts: { videoW: number; videoH: number; fps: number; defaultDur?: number }
): SlideSpec[] {
  const { videoW, videoH, fps, defaultDur = 7 } = opts;
  const mods = modifications || {};
  const templateWidth = resolveTemplateWidth(template, videoW);
  const slideMaxChars = resolveSlideMaxChars();
  const lastSlideIndex = detectLastSlideIndex(mods);
  const totalSlides = Math.max(0, lastSlideIndex + 1);

  const slides: SlideSpec[] = [];
  let prevEnd = 0;
  let globalShapeIndex = 0;

  for (let index = 0; index < totalSlides; index++) {
    const comp = findComposition(template, `Slide_${index}`);
    const visMod = mods[`Slide_${index}.visible`];
    const visible = comp?.visible !== false && isVisibleFlag(visMod);
    if (!visible) continue;

    const start = parseSec(mods[`Slide_${index}.time`], prevEnd);
    if (start > prevEnd + 0.001) {
      const gapDuration = start - prevEnd;
      const filler = createGapSlide(template, index, videoW, videoH, fps, gapDuration);
      slides.push(filler);
      prevEnd = start;
    }

    const { slide, duration, shapesUsed } = buildStandardSlide({
      index,
      mods,
      template,
      templateWidth,
      videoW,
      videoH,
      fps,
      defaultDuration: defaultDur,
      globalShapeIndex,
      slideMaxChars,
    });

    if (!slide) continue;

    slides.push(slide);
    prevEnd = start + duration;
    globalShapeIndex += shapesUsed;
  }

  const outro = buildOutroSegment({
    mods,
    template,
    templateWidth,
    videoW,
    videoH,
    fps,
    defaultDuration: defaultDur,
    prevEnd,
    fileIndex: slides.length,
  });

  if (outro.gap) {
    slides.push(outro.gap);
  }
  if (outro.slide) {
    slides.push(outro.slide);
  }

  return slides;
}
