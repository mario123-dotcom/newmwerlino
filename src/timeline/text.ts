import { TEXT } from "../config";
import { pctToPx, type TemplateElement } from "../template";
import { clampRect, lenToPx } from "./utils";
import {
  APPROX_CHAR_WIDTH_RATIO,
  DEFAULT_CHARS_PER_LINE,
  LINE_WIPE_DURATION,
  MIN_FONT_SIZE,
} from "./constants";
import type {
  DeriveFontOptions,
  FontSizingInfo,
  TextBlockSpec,
  TextLayoutResult,
} from "./types";

export { LINE_WIPE_DURATION };

const MAX_FONT_LAYOUT_ITERATIONS = 6;

export function wrapText(text: string, maxPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxPerLine && line) {
      lines.push(line);
      line = word;
    } else if (candidate.length > maxPerLine) {
      lines.push(word);
      line = "";
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function clampMaxChars(value: number, cap?: number): number {
  const numeric = Number.isFinite(value) ? Math.floor(value) : 0;
  const safeValue = Math.max(1, numeric);
  if (cap == null) return safeValue;
  if (!Number.isFinite(cap) || cap <= 0) return safeValue;
  const limited = Math.min(safeValue, Math.floor(cap));
  return Math.max(1, limited);
}

export function maxCharsForWidth(
  width: number,
  fontSize: number,
  cap?: number
): number {
  if (!(width > 0) || !(fontSize > 0)) {
    return clampMaxChars(DEFAULT_CHARS_PER_LINE, cap);
  }
  const approxChar = fontSize * APPROX_CHAR_WIDTH_RATIO;
  if (!(approxChar > 0)) return clampMaxChars(DEFAULT_CHARS_PER_LINE, cap);
  const maxChars = Math.floor(width / approxChar);
  return clampMaxChars(maxChars || 0, cap);
}

export function computeLineSpacingForBox(
  font: number,
  lineCount: number,
  boxHeight: number | undefined,
  lineHeightFactor: number
): number {
  const safeFont = Number.isFinite(font) && font > 0 ? font : MIN_FONT_SIZE;
  const safeLines = Math.max(1, lineCount);
  const height =
    typeof boxHeight === "number" && Number.isFinite(boxHeight) && boxHeight > 0
      ? boxHeight
      : 0;
  const lineHeightPx = height > 0 ? height / safeLines : safeFont * lineHeightFactor;
  const targetSpacing = Math.round(safeFont * Math.max(0, lineHeightFactor - 1));
  const availableSpacing = Math.round(Math.max(0, lineHeightPx - safeFont));
  const spacing = Math.min(targetSpacing, availableSpacing);
  return spacing > 0 ? spacing : 0;
}

export function deriveFontSizing(
  element: TemplateElement | undefined,
  fallback: number,
  canvasWidth: number,
  canvasHeight: number,
  opts?: DeriveFontOptions
): FontSizingInfo {
  const rawScale = opts?.scaleMultiplier;
  let scale = 1;
  if (typeof rawScale === "number" && Number.isFinite(rawScale) && rawScale > 0) {
    scale = rawScale;
  }
  const scaleCap =
    typeof TEXT.MAX_FONT_SCALE === "number" && Number.isFinite(TEXT.MAX_FONT_SCALE)
      ? Math.max(0, TEXT.MAX_FONT_SCALE)
      : undefined;
  if (scaleCap && scale > scaleCap) {
    scale = scaleCap;
  }

  const scaleValue = (value: number | undefined): number | undefined => {
    if (!(typeof value === "number" && Number.isFinite(value) && value > 0)) {
      return undefined;
    }
    const scaled = value * scale;
    if (!(Number.isFinite(scaled) && scaled > 0)) return undefined;
    return scaled;
  };

  const fallbackBase = Number.isFinite(fallback) && fallback > 0 ? fallback : MIN_FONT_SIZE;
  const fallbackFont = Math.max(MIN_FONT_SIZE, Math.round(fallbackBase * scale));

  const explicit = scaleValue(lenToPx((element as any)?.font_size, canvasWidth, canvasHeight));
  const min = scaleValue(lenToPx((element as any)?.font_size_minimum, canvasWidth, canvasHeight));
  const max = scaleValue(lenToPx((element as any)?.font_size_maximum, canvasWidth, canvasHeight));

  const clamp = (value: number): number => {
    let next = Number.isFinite(value) && value > 0 ? value : fallbackFont;
    if (typeof max === "number" && Number.isFinite(max) && max > 0) {
      next = Math.min(next, max);
    }
    if (typeof min === "number" && Number.isFinite(min) && min > 0) {
      next = Math.max(next, min);
    }
    if (!(next > 0)) next = fallbackFont;
    return Math.max(MIN_FONT_SIZE, Math.round(next));
  };

  let initial = fallbackFont;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    initial = explicit;
  } else {
    if (typeof min === "number" && Number.isFinite(min) && min > 0) {
      initial = Math.max(initial, min);
    }
    if (typeof max === "number" && Number.isFinite(max) && max > 0) {
      initial = Math.min(initial, max);
    }
  }

  initial = clamp(initial);
  return { initial, clamp };
}

export function computeWidthScaleFromTemplate(
  element: TemplateElement | undefined,
  finalWidth: number,
  templateWidth: number
): number {
  if (!element) return 1;
  if (!(finalWidth > 0)) return 1;
  if (!(templateWidth > 0)) return 1;
  const raw = pctToPx((element as any)?.width, templateWidth);
  if (!(typeof raw === "number" && Number.isFinite(raw) && raw > 0)) return 1;
  const ratio = finalWidth / raw;
  if (!(Number.isFinite(ratio) && ratio > 1)) return 1;
  return ratio;
}

export function parseLineHeightFactor(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw <= 0) return undefined;
    return raw > 10 ? raw / 100 : raw;
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.endsWith("%")) {
    const parsed = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(parsed) ? parsed / 100 : undefined;
  }
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed > 10 ? parsed / 100 : parsed;
}

export function parseLetterSpacing(
  raw: unknown,
  fontPx: number | undefined,
  canvasWidth: number,
  canvasHeight: number
): number | undefined {
  if (!(fontPx && fontPx > 0)) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.endsWith("%")) {
    const parsed = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(parsed)) return undefined;
    const normalized = parsed / 1000;
    const px = normalized * fontPx;
    return Number.isFinite(px) ? px : undefined;
  }
  const px = lenToPx(trimmed, canvasWidth, canvasHeight);
  if (typeof px === "number" && Number.isFinite(px)) return px;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function parseAlignmentFactor(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const normalized = raw > 1 ? raw / 100 : raw;
    return clamp01(normalized);
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.endsWith("%")) {
    const parsed = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(parsed) ? clamp01(parsed / 100) : undefined;
  }
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return clamp01(parsed > 1 ? parsed / 100 : parsed);
}

export function estimateLineWidth(
  line: string,
  fontPx: number,
  letterSpacingPx: number | undefined
): number {
  if (!(fontPx > 0)) return 0;
  const text = typeof line === "string" ? line : "";
  const baseWidth = text.length * fontPx * APPROX_CHAR_WIDTH_RATIO;
  if (!(baseWidth > 0)) return 0;
  if (!(letterSpacingPx && Number.isFinite(letterSpacingPx))) return baseWidth;
  const chars = Math.max(text.length - 1, 0);
  const spacing = Math.max(0, chars * letterSpacingPx);
  const total = baseWidth + spacing;
  return total > 0 ? total : 0;
}

export function estimateTextWidth(
  lines: string[],
  fontPx: number,
  letterSpacingPx: number | undefined
): number {
  if (!Array.isArray(lines) || !lines.length) return 0;
  let max = 0;
  for (const line of lines) {
    const width = estimateLineWidth(line ?? "", fontPx, letterSpacingPx);
    if (width > max) max = width;
  }
  return max;
}

export function applyHorizontalAlignment(
  block: TextBlockSpec,
  lines: string[],
  fontPx: number | undefined,
  letterSpacingPx: number | undefined,
  alignX: number | undefined,
  textBox: { x: number; w: number },
  maxWidth: number
): void {
  if (!lines.length) return;
  if (!(fontPx && fontPx > 0)) return;
  if (alignX == null) return;
  const safeAlign = clamp01(alignX);
  const textWidth = estimateTextWidth(lines, fontPx, letterSpacingPx);
  if (!(textWidth > 0)) return;

  if (textBox.w > 0) {
    const free = textBox.w - textWidth;
    if (!(free > 0)) return;
    const offset = Math.round(Math.min(free, Math.max(0, free * safeAlign)));
    block.x = textBox.x + offset;
    return;
  }

  const available = maxWidth - textWidth;
  if (!(available >= 0)) {
    block.x = 0;
    return;
  }
  const offset = Math.round(Math.max(0, available) * safeAlign);
  const upperBound = Math.max(0, Math.floor(available));
  const clamped = Math.max(0, Math.min(upperBound, offset));
  block.x = clamped;
}

function linesEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function resolveTextLayout(
  text: string,
  box: { w?: number; h?: number },
  initialFont: number,
  lineHeightFactor: number,
  opts?: { widthScale?: number; maxCharsPerLine?: number }
): TextLayoutResult | undefined {
  if (!text) return undefined;
  const width = typeof box.w === "number" ? box.w : 0;
  const height = typeof box.h === "number" ? box.h : 0;
  const safeInitial =
    Number.isFinite(initialFont) && initialFont > 0
      ? Math.round(initialFont)
      : MIN_FONT_SIZE;
  let fontGuess = Math.max(MIN_FONT_SIZE, safeInitial);
  let prevLines: string[] | undefined;
  let prevFont = fontGuess;
  const layouts: TextLayoutResult[] = [];
  const widthMultiplier =
    opts && typeof opts.widthScale === "number" && opts.widthScale > 1
      ? opts.widthScale
      : 1;

  const maxCharsCap =
    opts && typeof opts.maxCharsPerLine === "number" && opts.maxCharsPerLine > 0
      ? opts.maxCharsPerLine
      : undefined;

  for (let iter = 0; iter < MAX_FONT_LAYOUT_ITERATIONS; iter++) {
    const wrapFont = widthMultiplier > 1 ? fontGuess / widthMultiplier : fontGuess;
    const maxChars =
      width > 0
        ? maxCharsForWidth(width, wrapFont, maxCharsCap)
        : clampMaxChars(DEFAULT_CHARS_PER_LINE, maxCharsCap);
    const lines = wrapText(text, maxChars);
    if (!lines.length) break;

    const safeCount = Math.max(1, lines.length);
    const lineHeightPx = height > 0 ? height / safeCount : fontGuess * lineHeightFactor;

    let heightFont = Math.round(lineHeightPx / lineHeightFactor);
    if (!Number.isFinite(heightFont) || heightFont <= 0) {
      heightFont = fontGuess;
    }
    heightFont = Math.max(MIN_FONT_SIZE, heightFont);

    let widthFont = heightFont;
    if (width > 0) {
      const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
      if (longest > 0) {
        const approx = Math.floor(width / (longest * APPROX_CHAR_WIDTH_RATIO));
        if (Number.isFinite(approx) && approx > 0) {
          const scaledApprox = widthMultiplier > 1 ? approx * widthMultiplier : approx;
          widthFont = Math.max(MIN_FONT_SIZE, scaledApprox);
        }
      }
    }

    let nextFont = Math.max(MIN_FONT_SIZE, Math.min(heightFont, widthFont));
    if (!Number.isFinite(nextFont) || nextFont <= 0) {
      nextFont = fontGuess;
    }

    const targetSpacing = Math.round(nextFont * Math.max(0, lineHeightFactor - 1));
    const availableSpacing = Math.round(Math.max(0, lineHeightPx - nextFont));
    const spacing = Math.min(targetSpacing, availableSpacing);

    const layout: TextLayoutResult = { lines: [...lines], font: nextFont, spacing };
    layouts.push(layout);

    const fontDiff = Math.abs(nextFont - prevFont);
    if (fontDiff === 0 && prevLines && linesEqual(lines, prevLines)) {
      break;
    }
    if (prevLines && linesEqual(lines, prevLines) && fontDiff <= 1) {
      prevFont = nextFont;
      break;
    }
    if (fontDiff <= 1 && (!prevLines || linesEqual(lines, prevLines))) {
      prevFont = nextFont;
      break;
    }

    prevLines = [...lines];
    prevFont = nextFont;
    fontGuess = nextFont;
  }

  if (!layouts.length) return undefined;

  for (let idx = layouts.length - 1; idx >= 0; idx--) {
    const candidate = layouts[idx];
    const wrapFont =
      widthMultiplier > 1 ? candidate.font / widthMultiplier : candidate.font;
    const maxChars =
      width > 0
        ? maxCharsForWidth(width, wrapFont, maxCharsCap)
        : clampMaxChars(DEFAULT_CHARS_PER_LINE, maxCharsCap);
    const recomputed = wrapText(text, maxChars);
    if (linesEqual(recomputed, candidate.lines)) {
      return candidate;
    }
  }

  return layouts[layouts.length - 1];
}

export function fitTextWithTargetFont(
  text: string,
  layoutWidth: number | undefined,
  actualBox: { w: number; h: number },
  desiredFont: number,
  minimumFont: number,
  widthScale: number,
  lineHeightFactor: number,
  maxCharsPerLine?: number
): TextLayoutResult | undefined {
  if (!text) return undefined;
  const safeWidth =
    typeof layoutWidth === "number" && layoutWidth > 0
      ? layoutWidth
      : actualBox.w > 0
      ? actualBox.w
      : 0;
  const safeHeight = actualBox.h > 0 ? actualBox.h : 0;
  if (!(safeWidth > 0) && !(safeHeight > 0)) return undefined;

  const widthMultiplier = widthScale > 1 ? widthScale : 1;
  const upper = Math.max(MIN_FONT_SIZE, Math.round(desiredFont));
  const lower = Math.max(MIN_FONT_SIZE, Math.round(minimumFont));

  for (let font = upper; font >= lower; font--) {
    const wrapFont = widthMultiplier > 1 ? font / widthMultiplier : font;
    const maxChars =
      safeWidth > 0
        ? maxCharsForWidth(safeWidth, wrapFont, maxCharsPerLine)
        : clampMaxChars(DEFAULT_CHARS_PER_LINE, maxCharsPerLine);
    const lines = wrapText(text, maxChars);
    if (!lines.length) continue;

    const spacing = computeLineSpacingForBox(font, lines.length, safeHeight, lineHeightFactor);
    const usedHeight = font * lines.length + spacing * Math.max(0, lines.length - 1);
    if (safeHeight > 0 && usedHeight > safeHeight + 0.01) {
      continue;
    }

    const approxWidth = estimateTextWidth(lines, font, undefined);
    const maxWidth = actualBox.w > 0 ? actualBox.w : safeWidth;
    if (maxWidth > 0 && approxWidth > maxWidth + 0.01) {
      continue;
    }

    return { lines, font, spacing };
  }

  return undefined;
}

export function applyExtraBackgroundPadding(
  block: TextBlockSpec,
  fontPx: number | undefined,
  maxW: number,
  maxH: number
): number {
  if (!(fontPx && fontPx > 0)) return 0;
  const extra = Math.round(fontPx * TEXT.BOX_PAD_FACTOR);
  if (!(extra > 0)) return 0;

  if (block.background) {
    const grown = clampRect(
      block.background.x - extra,
      block.background.y - extra,
      block.background.width + extra * 2,
      block.background.height + extra * 2,
      maxW,
      maxH
    );
    if (grown) {
      block.background = {
        ...block.background,
        x: grown.x,
        y: grown.y,
        width: grown.w,
        height: grown.h,
      };
    }
  }

  if (block.box) {
    const prev = block.boxBorderW ?? 0;
    block.boxBorderW = prev + extra;
  } else if (typeof block.boxBorderW === "number") {
    block.boxBorderW = block.boxBorderW + extra;
  }

  return extra;
}

export type { TextLayoutResult } from "./types";
