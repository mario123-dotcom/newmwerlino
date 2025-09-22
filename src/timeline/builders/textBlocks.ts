import { writeTextFilesForSlide } from "../assets";
import {
  applyExtraBackgroundPadding,
  applyHorizontalAlignment,
  clampMaxChars,
  computeLineSpacingForBox,
  maxCharsForWidth,
  parseAlignmentFactor,
  parseLetterSpacing,
  parseLineHeightFactor,
  resolveTextLayout,
  wrapText,
  fitTextWithTargetFont,
} from "../text";
import {
  DEFAULT_CHARS_PER_LINE,
  LINE_WIPE_DURATION,
  LINE_WIPE_OVERLAP,
} from "../constants";
import type { AnimationSpec, FontSizingInfo, TextBlockSpec } from "../types";
import type { TemplateElement } from "../../template";
import { clampRect, lenToPx, parseRGBA, parseSec } from "../utils";

type TextBox = { x: number; y: number; w: number; h: number };

type RawAnimation = {
  type?: string;
  duration?: number | string;
  time?: number | string;
  reversed?: boolean;
  split?: string;
  axis?: string;
  x_anchor?: string | number;
  y_anchor?: string | number;
};

type BuildTextBlocksParams = {
  text: string;
  fileIndex: number;
  textBox: TextBox;
  layoutBox?: TextBox;
  baseBlock: TextBlockSpec;
  fontSizing: FontSizingInfo;
  widthScale: number;
  videoW: number;
  videoH: number;
  templateElement?: TemplateElement;
  slideMaxChars?: number;
  defaultLineHeightFactor?: number;
  defaultAlignX?: number;
  defaultAlignY?: number;
  respectManualBreaks?: boolean;
  animations?: RawAnimation[];
};

type BuildTextBlocksResult = {
  base: TextBlockSpec;
  lines: string[];
  blocks: TextBlockSpec[];
};

function normalizeColorInput(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return undefined;

  const rgba = parseRGBA(value);
  if (rgba) {
    const alpha = Math.max(0, Math.min(1, rgba.alpha));
    if (alpha < 1) {
      const normalized = Number.isFinite(alpha) ? Number(alpha.toFixed(3)) : alpha;
      return `${rgba.color}@${normalized}`;
    }
    return rgba.color;
  }

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let body = hex[1].toLowerCase();
    if (body.length === 3) {
      body = body
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return `#${body}`;
  }

  return value;
}

function applyTemplateBackground(
  block: TextBlockSpec,
  textBox: TextBox,
  element: TemplateElement | undefined,
  videoW: number,
  videoH: number
): void {
  if (!element) return;
  const bg = parseRGBA((element as any)?.background_color);
  if (!bg) return;

  const rawPadX = lenToPx((element as any)?.x_padding, videoW, videoH) ?? 0;
  const rawPadY = lenToPx((element as any)?.y_padding, videoW, videoH) ?? 0;
  const padX = Math.max(0, rawPadX);
  const padY = Math.max(0, rawPadY);
  const rect = clampRect(
    textBox.x - padX,
    textBox.y - padY,
    textBox.w > 0 ? textBox.w + padX * 2 : 0,
    textBox.h > 0 ? textBox.h + padY * 2 : 0,
    videoW,
    videoH
  );

  if (rect) {
    block.background = {
      x: rect.x,
      y: rect.y,
      width: rect.w,
      height: rect.h,
      color: bg.color,
      alpha: bg.alpha,
    };
  }

  block.box = true;
  block.boxColor = bg.color;
  block.boxAlpha = bg.alpha;

  const pad = Math.round(Math.max(padX, padY));
  if (pad > 0) {
    block.boxBorderW = pad;
  }
}

function buildLineAnimations(
  anims: RawAnimation[] | undefined,
  lineCount: number
): AnimationSpec[][] {
  const perLine: AnimationSpec[][] = Array.from({ length: lineCount }, () => []);
  if (!Array.isArray(anims) || !anims.length) return perLine;

  for (const animation of anims) {
    if (!animation || animation.reversed === true) continue;
    const dur = parseSec(animation.duration, 0);
    if (!(dur > 0)) continue;

    if (animation.type === "fade") {
      const atEnd = typeof animation.time === "string" && animation.time.trim().toLowerCase() === "end";
      if (atEnd) continue;
      const time = parseSec(animation.time, 0);
      for (const list of perLine) {
        list.push({ type: "fade", time, duration: dur });
      }
    }
  }

  const reveal = anims.find(
    (a) => a && a.type === "text-reveal" && (a as RawAnimation).split === "line"
  );
  if (reveal) {
    const axis = String(reveal.axis ?? "x").toLowerCase();
    let direction: "wipeleft" | "wiperight" | "wipeup" | "wipedown" = "wiperight";
    if (axis === "y") {
      const anchor = String(reveal.y_anchor ?? "").trim();
      direction = anchor === "100%" ? "wipedown" : "wipeup";
    } else {
      const anchor = String(reveal.x_anchor ?? "").trim();
      direction = anchor === "100%" ? "wipeleft" : "wiperight";
    }
    const baseDuration = Math.max(LINE_WIPE_DURATION, 0.01);
    const maxOverlap = Math.max(0, baseDuration - 0.01);
    const overlap = Math.max(0, Math.min(LINE_WIPE_OVERLAP, maxOverlap));
    const step = overlap > 0 ? baseDuration - overlap : baseDuration;
    const duration = Number(baseDuration.toFixed(4));
    for (let idx = 0; idx < perLine.length; idx++) {
      const start = Number((idx * step).toFixed(4));
      perLine[idx].push({
        type: "wipe",
        time: start,
        duration,
        direction,
      });
    }
  }

  return perLine;
}

export function buildTextBlocks(params: BuildTextBlocksParams): BuildTextBlocksResult {
  const {
    text,
    fileIndex,
    textBox,
    layoutBox = textBox,
    baseBlock,
    fontSizing,
    widthScale,
    videoW,
    videoH,
    templateElement,
    slideMaxChars,
    defaultLineHeightFactor = 1.35,
    defaultAlignX,
    defaultAlignY = 0,
    respectManualBreaks,
    animations,
  } = params;

  const block: TextBlockSpec = {
    ...baseBlock,
    background: baseBlock.background ? { ...baseBlock.background } : undefined,
  };

  applyTemplateBackground(block, textBox, templateElement, videoW, videoH);

  const templateProps = (templateElement ?? {}) as any;
  const colorCandidates: unknown[] = [
    templateProps?.fill_color,
    templateProps?.fillColor,
    templateProps?.color,
    templateProps?.font_color,
    templateProps?.text_color,
  ];
  for (const candidate of colorCandidates) {
    const normalized = normalizeColorInput(candidate);
    if (normalized) {
      block.fontColor = normalized;
      break;
    }
  }
  const lineHeightFactor =
    parseLineHeightFactor(templateProps?.line_height) ?? defaultLineHeightFactor;

  const initialFontSize = fontSizing.initial;
  block.fontSize = initialFontSize;

  const computeSpacing = (font: number, lineCount: number): number =>
    computeLineSpacingForBox(font, lineCount, textBox.h, lineHeightFactor);

  const wrapFontInitial = widthScale > 1 ? initialFontSize / widthScale : initialFontSize;
  const initialMax =
    typeof layoutBox.w === "number" && layoutBox.w > 0
      ? maxCharsForWidth(layoutBox.w, wrapFontInitial, slideMaxChars)
      : clampMaxChars(DEFAULT_CHARS_PER_LINE, slideMaxChars);

  const manualBreaks = respectManualBreaks && text.includes("\n");
  let lines = manualBreaks ? text.split(/\r?\n/) : wrapText(text, initialMax);
  if (manualBreaks) {
    lines = lines.map((line) => line.trim()).filter((line) => line);
  }

  if (!lines.length) {
    block.fontSize = fontSizing.clamp(initialFontSize);
    block.lineSpacing = computeSpacing(block.fontSize, 0);
    return { base: block, lines: [], blocks: [] };
  }

  const applyClamp = (value: number): number => fontSizing.clamp(value);

  const layout = resolveTextLayout(text, layoutBox, block.fontSize ?? initialFontSize, lineHeightFactor, {
    widthScale,
    maxCharsPerLine: slideMaxChars,
  });

  if (layout) {
    lines = [...layout.lines];
    const adjustedFont = applyClamp(layout.font);
    block.fontSize = adjustedFont;
    block.lineSpacing = computeSpacing(adjustedFont, lines.length);
  } else {
    const candidate = applyClamp(block.fontSize ?? initialFontSize);
    block.fontSize = candidate;
    block.lineSpacing = computeSpacing(candidate, lines.length);
  }

  if (widthScale > 1) {
    const desired = applyClamp(initialFontSize);
    const current = block.fontSize ?? initialFontSize;
    if (desired > current) {
      const manual = fitTextWithTargetFont(
        text,
        typeof layoutBox.w === "number" ? layoutBox.w : textBox.w,
        { w: textBox.w, h: textBox.h },
        desired,
        current,
        widthScale,
        lineHeightFactor,
        slideMaxChars
      );
      if (manual) {
        lines = [...manual.lines];
        const adjustedFont = applyClamp(manual.font);
        block.fontSize = adjustedFont;
        block.lineSpacing = computeSpacing(adjustedFont, lines.length);
      }
    }
  }

  const finalFont = block.fontSize ?? initialFontSize;
  applyExtraBackgroundPadding(block, finalFont, videoW, videoH);

  const alignSource =
    templateProps?.x_alignment ??
    templateProps?.text_align ??
    templateProps?.text_alignment ??
    templateProps?.horizontal_alignment ??
    templateProps?.align ??
    templateProps?.alignment;
  let alignX = defaultAlignX ?? parseAlignmentFactor(alignSource);
  if (alignX == null) {
    alignX = parseAlignmentFactor(templateProps?.x_anchor);
  }
  const letterSpacingPx = parseLetterSpacing(
    templateProps?.letter_spacing,
    finalFont,
    videoW,
    videoH
  );

  applyHorizontalAlignment(block, lines, finalFont, letterSpacingPx, alignX, textBox, videoW);

  const alignY = parseAlignmentFactor(templateProps?.y_alignment) ?? defaultAlignY;
  block.y = textBox.y;
  if (textBox.h > 0) {
    const spacing = block.lineSpacing ?? 0;
    const usedHeight = finalFont * lines.length + spacing * Math.max(0, lines.length - 1);
    if (usedHeight > 0) {
      const free = textBox.h - usedHeight;
      if (free > 0 && alignY > 0) {
        const offset = Math.round(Math.min(free, Math.max(0, free * alignY)));
        block.y = textBox.y + offset;
      }
    }
  }

  const perLine = buildLineAnimations(animations ?? templateProps?.animations, lines.length);
  const textFiles = writeTextFilesForSlide(fileIndex, lines);
  const lineHeight = (block.fontSize ?? 60) + (block.lineSpacing ?? 8);
  const backgroundRect = block.background ? { ...block.background } : undefined;

  const blocks = textFiles.map((filePath, idx) => ({
    ...block,
    background: idx === 0 ? backgroundRect : undefined,
    y: block.y + idx * lineHeight,
    textFile: filePath,
    animations: perLine[idx]?.length ? perLine[idx] : undefined,
  }));

  return { base: block, lines, blocks };
}
