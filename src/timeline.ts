import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { paths } from "./paths";
import { findComposition, findChildByName, pctToPx } from "./template";
import type { TemplateDoc, TemplateElement } from "./template";
import { probeDurationSec } from "./ffmpeg/probe";
import { TEXT } from "./config";
import { fileNameMatchesFamily } from "./fonts";

/* ---------- Tipi usati da composition.ts ---------- */
export type AnimationSpec =
  | {
      type: "fade";
      time: number | "end";
      duration: number;
      reversed?: boolean;
    }
  | {
      type: "wipe";
      time: number;
      duration: number;
      direction: "wipeleft" | "wiperight" | "wipeup" | "wipedown";
    };

export type TextBlockSpec = {
  textFile?: string;
  text?: string;

  x: number;
  y: number;

  fontFile?: string;
  fontSize?: number;
  fontColor?: string;
  lineSpacing?: number;
  box?: boolean;
  boxColor?: string;
  boxAlpha?: number;
  boxBorderW?: number;
  background?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    alpha: number;
  };

  animations?: AnimationSpec[];
};

export type ShapeBlockSpec = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  animations?: AnimationSpec[];
};

export type SlideSpec = {
  width?: number;
  height?: number;
  fps: number;
  durationSec: number;
  outPath: string;

  bgImagePath?: string;
  logoPath?: string;
  ttsPath?: string;
  fontFile?: string;

  backgroundAnimated?: boolean;

  // Posizionamento e dimensione logo (px)
  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
  logoY?: number;

  texts?: TextBlockSpec[];

  shapes?: ShapeBlockSpec[];

  // overlay shadow on background
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowAlpha?: number;
  shadowW?: number;
  shadowH?: number;
};

/* ---------- Util ---------- */
const LINE_WIPE_DURATION = 0.5;
function ensureTempDir() {
  try { mkdirSync(paths.temp, { recursive: true }); } catch {}
}

function parseSec(v: any, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return fallback;
  const s = v.trim().toLowerCase().replace(",", ".");
  if (s.endsWith("ms")) {
    const n = parseFloat(s.replace("ms", ""));
    return Number.isFinite(n) ? n / 1000 : fallback;
  }
  if (s.endsWith("s")) {
    const n = parseFloat(s.replace("s", ""));
    return Number.isFinite(n) ? n : fallback;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

function lenToPx(v: any, W: number, H: number): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim().toLowerCase();
  if (!trimmed) return undefined;
  const s = trimmed.replace(/\s+/g, "");
  if (s.endsWith("vmin")) {
    const n = parseFloat(s.slice(0, -4));
    return Number.isFinite(n) ? (n / 100) * Math.min(W, H) : undefined;
  }
  if (s.endsWith("vmax")) {
    const n = parseFloat(s.slice(0, -4));
    return Number.isFinite(n) ? (n / 100) * Math.max(W, H) : undefined;
  }
  if (s.endsWith("vh")) {
    const n = parseFloat(s.slice(0, -2));
    return Number.isFinite(n) ? (n / 100) * H : undefined;
  }
  if (s.endsWith("vw")) {
    const n = parseFloat(s.slice(0, -2));
    return Number.isFinite(n) ? (n / 100) * W : undefined;
  }
  if (s.endsWith("px")) {
    const n = parseFloat(s.slice(0, -2));
    return Number.isFinite(n) ? n : undefined;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function clampRect(
  x: number,
  y: number,
  w: number,
  h: number,
  maxW: number,
  maxH: number
): { x: number; y: number; w: number; h: number } | undefined {
  if (!(w > 0) || !(h > 0)) return undefined;
  if (!(maxW > 0) || !(maxH > 0)) return undefined;

  let left = x;
  let top = y;
  let right = x + w;
  let bottom = y + h;

  left = Math.max(0, Math.min(left, maxW));
  top = Math.max(0, Math.min(top, maxH));
  right = Math.max(left, Math.min(right, maxW));
  bottom = Math.max(top, Math.min(bottom, maxH));

  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) return undefined;

  return {
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(width),
    h: Math.round(height),
  };
}

function applyExtraBackgroundPadding(
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

function parseAlpha(val: any): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (!s) return undefined;
  if (s.endsWith("%")) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : undefined;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function readBooleanish(val: any): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (typeof val === "number" && Number.isFinite(val)) {
    return val === 0 ? false : true;
  }
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (!s) return undefined;
  if (["true", "yes", "on", "1"].includes(s)) return true;
  if (["false", "no", "off", "0"].includes(s)) return false;
  return undefined;
}

function parseShadowColor(raw: any): { color: string; alpha?: number } | undefined {
  if (typeof raw !== "string") return undefined;
  const input = raw.trim();
  if (!input) return undefined;
  const rgba = parseRGBA(input);
  if (rgba) return rgba;
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let value = hex[1];
    if (value.length === 3) {
      value = value
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return { color: `#${value.toLowerCase()}` };
  }
  return { color: input };
}

function parseShadowLength(
  v: any,
  axis: "x" | "y",
  W: number,
  H: number
): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (!s) return undefined;
    if (s.endsWith("%")) {
      const n = parseFloat(s.slice(0, -1));
      if (!Number.isFinite(n)) return undefined;
      const base = axis === "x" ? W : H;
      return (n / 100) * base;
    }
  }
  return lenToPx(v, W, H);
}

type ShadowInfo = {
  color?: string;
  alpha?: number;
  w?: number;
  h?: number;
  declared?: boolean;
};

function isShadowCandidate(element: TemplateElement | undefined): boolean {
  if (!element) return false;
  if ((element as any)?.visible === false) return false;
  const type = typeof element.type === "string" ? element.type.toLowerCase() : "";
  if (type === "text" || type === "audio") return false;
  const name = typeof element.name === "string" ? element.name.trim().toLowerCase() : "";
  if (
    name.startsWith("logo") ||
    name.startsWith("avatar") ||
    name.startsWith("copyright") ||
    name.startsWith("testo")
  ) {
    return false;
  }
  return true;
}

function hasShadowHintElement(element: TemplateElement | undefined): boolean {
  if (!element) return false;
  if (isGradientShadowElement(element)) return true;
  if (isShadowCandidate(element)) {
    for (const key of Object.keys(element as any)) {
      if (key.toLowerCase().includes("shadow")) {
        const value = (element as any)[key];
        if (
          value === false ||
          value === 0 ||
          (typeof value === "string" && value.trim().toLowerCase() === "false")
        ) {
          continue;
        }
        return true;
      }
    }
  }
  if (Array.isArray((element as any)?.elements)) {
    for (const child of (element as any).elements as TemplateElement[]) {
      if (hasShadowHintElement(child)) return true;
    }
  }
  return false;
}

function isGradientShadowElement(element: TemplateElement | undefined): boolean {
  if (!element) return false;
  if ((element as any)?.visible === false) return false;
  const type = typeof element.type === "string" ? element.type.toLowerCase() : "";
  if (type !== "shape") return false;
  const fill = (element as any)?.fill_color ?? (element as any)?.fillColor;
  if (!Array.isArray(fill) || fill.length < 2) return false;
  const name = typeof element.name === "string" ? element.name.trim().toLowerCase() : "";
  if (name.includes("gradient") || name.includes("ombra") || name.includes("shadow")) {
    return true;
  }
  let hasTransparentStop = false;
  let hasOpaqueStop = false;
  for (const stop of fill) {
    const color = typeof stop?.color === "string" ? stop.color : undefined;
    const parsed = parseShadowColor(color);
    if (!parsed) continue;
    if (parsed.alpha !== undefined && parsed.alpha <= 0.001) {
      hasTransparentStop = true;
    } else {
      hasOpaqueStop = true;
    }
  }
  return hasTransparentStop && hasOpaqueStop;
}

function extractGradientShadow(
  source: TemplateElement,
  W: number,
  H: number
): ShadowInfo | undefined {
  if (!isGradientShadowElement(source)) return undefined;
  const fill = ((source as any)?.fill_color ?? (source as any)?.fillColor) as any[];
  const info: ShadowInfo = { declared: true };

  for (const stop of fill) {
    const color = typeof stop?.color === "string" ? stop.color : undefined;
    const parsed = parseShadowColor(color);
    if (!parsed) continue;
    if (parsed.color) info.color = parsed.color;
    if (parsed.alpha !== undefined) info.alpha = parsed.alpha;
  }

  const widthPx = pctToPx((source as any)?.width, W);
  const heightPx = pctToPx((source as any)?.height, H);
  if (typeof widthPx === "number" && Number.isFinite(widthPx) && widthPx > 0) {
    info.w = widthPx;
  }
  if (typeof heightPx === "number" && Number.isFinite(heightPx) && heightPx > 0) {
    info.h = heightPx;
  }
  if (info.w === undefined) info.w = W;
  if (info.h === undefined) info.h = H;

  const opacity = parseAlpha((source as any)?.opacity);
  if (opacity !== undefined) {
    const base = info.alpha ?? 1;
    info.alpha = Math.max(0, Math.min(1, base * opacity));
  }

  return info;
}

function extractShadowFromElementProps(
  source: TemplateElement,
  W: number,
  H: number
): ShadowInfo | undefined {
  const rawColor =
    (source as any)?.shadow_color ??
    (source as any)?.shadowColor ??
    (source as any)?.background_shadow_color ??
    (source as any)?.backgroundShadowColor;
  const rawAlpha =
    (source as any)?.shadow_alpha ??
    (source as any)?.shadowAlpha ??
    (source as any)?.shadow_opacity ??
    (source as any)?.shadowOpacity ??
    (source as any)?.background_shadow_alpha ??
    (source as any)?.backgroundShadowAlpha ??
    (source as any)?.background_shadow_opacity ??
    (source as any)?.backgroundShadowOpacity;
  const rawX =
    (source as any)?.shadow_x ??
    (source as any)?.shadowX ??
    (source as any)?.shadow_width ??
    (source as any)?.shadowWidth ??
    (source as any)?.background_shadow_x ??
    (source as any)?.backgroundShadowX ??
    (source as any)?.background_shadow_width ??
    (source as any)?.backgroundShadowWidth;
  const rawY =
    (source as any)?.shadow_y ??
    (source as any)?.shadowY ??
    (source as any)?.shadow_height ??
    (source as any)?.shadowHeight ??
    (source as any)?.background_shadow_y ??
    (source as any)?.backgroundShadowY ??
    (source as any)?.background_shadow_height ??
    (source as any)?.backgroundShadowHeight;

  const declared =
    rawColor != null || rawAlpha != null || rawX != null || rawY != null;
  if (!declared) return undefined;

  const info: ShadowInfo = { declared: true };
  const parsedColor = parseShadowColor(rawColor);
  if (parsedColor?.color) info.color = parsedColor.color;
  if (parsedColor?.alpha !== undefined) info.alpha = parsedColor.alpha;

  const parsedAlpha = parseAlpha(rawAlpha);
  if (parsedAlpha !== undefined) info.alpha = parsedAlpha;

  const sw = parseShadowLength(rawX, "x", W, H);
  if (typeof sw === "number" && Number.isFinite(sw)) info.w = sw;
  const sh = parseShadowLength(rawY, "y", W, H);
  if (typeof sh === "number" && Number.isFinite(sh)) info.h = sh;

  return info;
}

function extractShadow(
  source: TemplateElement | undefined,
  W: number,
  H: number
): ShadowInfo | undefined {
  if (!source) return undefined;
  const merged = mergeShadows(
    extractGradientShadow(source, W, H),
    extractShadowFromElementProps(source, W, H)
  );
  if (merged.declared) return merged;
  return hasShadowHintElement(source) ? { declared: true } : undefined;
}

function readShadowMod(
  mods: Record<string, any>,
  prefix: string,
  keys: string[]
): any {
  for (const key of keys) {
    const full = `${prefix}.${key}`;
    if (mods[full] !== undefined) return mods[full];
  }
  return undefined;
}

function extractShadowFromMods(
  mods: Record<string, any>,
  prefix: string,
  W: number,
  H: number
): ShadowInfo | undefined {
  const rawColor = readShadowMod(mods, prefix, [
    "shadow_color",
    "shadowColor",
    "shadow-colour",
    "shadowColour",
    "background_shadow_color",
    "backgroundShadowColor",
  ]);
  const rawAlpha = readShadowMod(mods, prefix, [
    "shadow_alpha",
    "shadowAlpha",
    "shadow_opacity",
    "shadowOpacity",
    "background_shadow_alpha",
    "backgroundShadowAlpha",
    "background_shadow_opacity",
    "backgroundShadowOpacity",
  ]);
  const rawX = readShadowMod(mods, prefix, [
    "shadow_x",
    "shadowX",
    "shadow_width",
    "shadowWidth",
    "background_shadow_x",
    "backgroundShadowX",
    "background_shadow_width",
    "backgroundShadowWidth",
  ]);
  const rawY = readShadowMod(mods, prefix, [
    "shadow_y",
    "shadowY",
    "shadow_height",
    "shadowHeight",
    "background_shadow_y",
    "backgroundShadowY",
    "background_shadow_height",
    "backgroundShadowHeight",
  ]);

  if (rawColor == null && rawAlpha == null && rawX == null && rawY == null) {
    return hasShadowHintInMods(mods, prefix) ? { declared: true } : undefined;
  }

  const info: ShadowInfo = { declared: true };
  const parsedColor = parseShadowColor(rawColor);
  if (parsedColor?.color) info.color = parsedColor.color;
  if (parsedColor?.alpha !== undefined) info.alpha = parsedColor.alpha;

  const parsedAlpha = parseAlpha(rawAlpha);
  if (parsedAlpha !== undefined) info.alpha = parsedAlpha;

  const sw = parseShadowLength(rawX, "x", W, H);
  if (typeof sw === "number" && Number.isFinite(sw)) info.w = sw;
  const sh = parseShadowLength(rawY, "y", W, H);
  if (typeof sh === "number" && Number.isFinite(sh)) info.h = sh;

  return info;
}

function mergeShadows(...parts: (ShadowInfo | undefined)[]): ShadowInfo {
  const merged: ShadowInfo = {};
  for (const part of parts) {
    if (!part) continue;
    if (part.declared) merged.declared = true;
    if (part.color !== undefined) merged.color = part.color;
    if (part.alpha !== undefined) merged.alpha = part.alpha;
    if (part.w !== undefined) merged.w = part.w;
    if (part.h !== undefined) merged.h = part.h;
  }
  return merged;
}

function hasShadowHintInMods(mods: Record<string, any>, prefix: string): boolean {
  if (!mods) return false;
  const prefixLower = prefix.toLowerCase();
  const prefixDot = `${prefixLower}.`;
  for (const key of Object.keys(mods)) {
    if (typeof key !== "string") continue;
    const lowerKey = key.toLowerCase();
    if (!lowerKey.startsWith(prefixDot)) continue;
    if (!lowerKey.includes("shadow")) continue;
    const value = mods[key];
    if (
      value === false ||
      value === 0 ||
      (typeof value === "string" && value.trim().toLowerCase() === "false")
    ) {
      continue;
    }
    return true;
  }
  return false;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function slideBackgroundNameCandidates(index: number): string[] {
  const idx = String(index);
  return uniqueNames([
    `Immagine-${idx}`,
    `Immagine_${idx}`,
    `Immagine ${idx}`,
    `Image-${idx}`,
    `Image_${idx}`,
    `Image ${idx}`,
    `Background-${idx}`,
    `Background_${idx}`,
    `Background ${idx}`,
    `Media-${idx}`,
    `Media_${idx}`,
    `Media ${idx}`,
    `Video-${idx}`,
    `Video_${idx}`,
    `Video ${idx}`,
    `Foto-${idx}`,
    `Foto_${idx}`,
    `Foto ${idx}`,
    "Immagine",
    "Image",
    "Background",
    "Media",
    "Video",
    "Foto",
  ]);
}

function outroBackgroundNameCandidates(): string[] {
  return uniqueNames([
    "Immagine-outro",
    "Immagine_outro",
    "Immagine outro",
    "Image-outro",
    "Image_outro",
    "Image outro",
    "Background-outro",
    "Background_outro",
    "Background outro",
    "Media-outro",
    "Media_outro",
    "Media outro",
    "Video-outro",
    "Video_outro",
    "Video outro",
    "Foto-outro",
    "Foto_outro",
    "Foto outro",
    "Immagine",
    "Image",
    "Background",
    "Media",
    "Video",
    "Foto",
  ]);
}

function findShadowBearingDescendant(
  parent: TemplateElement | undefined
): TemplateElement | undefined {
  if (!parent || !Array.isArray(parent.elements)) return undefined;
  for (const child of parent.elements) {
    if (!child) continue;
    const hasShadowProps =
      (child as any)?.shadow_color != null ||
      (child as any)?.shadow_x != null ||
      (child as any)?.shadow_y != null;
    const gradientCandidate = isGradientShadowElement(child);
    if ((hasShadowProps || gradientCandidate) && isShadowCandidate(child)) {
      return child;
    }
    const nested = findShadowBearingDescendant(child);
    if (nested) return nested;
  }
  return undefined;
}

function findShadowSource(
  comp: TemplateElement | undefined,
  candidates: string[]
): TemplateElement | undefined {
  if (!comp) return undefined;
  for (const name of candidates) {
    const found = findChildByName(comp, name);
    if (found) return found;
  }
  return findShadowBearingDescendant(comp);
}

function parseRGBA(c: any): { color: string; alpha: number } | undefined {
  if (typeof c !== "string") return undefined;
  const m = c
    .trim()
    .match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i);
  if (!m) return undefined;
  const r = Math.max(0, Math.min(255, parseInt(m[1], 10)));
  const g = Math.max(0, Math.min(255, parseInt(m[2], 10)));
  const b = Math.max(0, Math.min(255, parseInt(m[3], 10)));
  const a = m[4] != null ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return { color: `#${hex}`, alpha: a };
}

function parsePercent(val: any): number | undefined {
  if (val == null) return undefined;
  if (typeof val === "number" && Number.isFinite(val)) {
    const n = val <= 1 && val >= 0 ? val : val / 100;
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(1, n));
  }
  if (typeof val !== "string") return undefined;
  const s = val.trim();
  if (!s) return undefined;
  if (s.endsWith("%")) {
    const n = parseFloat(s.slice(0, -1));
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(1, n / 100));
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return undefined;
  if (Math.abs(n) <= 1) {
    return Math.max(0, Math.min(1, n));
  }
  return Math.max(0, Math.min(1, n / 100));
}

function parseAngleDeg(val: any): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val !== "string") return undefined;
  const s = val.trim();
  if (!s) return undefined;
  const cleaned = s.replace(/deg$/i, "");
  const withoutDegree = cleaned.endsWith("°")
    ? cleaned.slice(0, -1)
    : cleaned;
  const n = parseFloat(withoutDegree);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeAngle(angle: number): number {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
}

function parseShapeColor(raw: any): { color: string; alpha: number } | undefined {
  if (typeof raw !== "string") return undefined;
  const input = raw.trim();
  if (!input) return undefined;
  const rgba = parseRGBA(input);
  if (rgba) return rgba;
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let value = hex[1];
    if (value.length === 3) {
      value = value
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return { color: `#${value.toLowerCase()}`, alpha: 1 };
  }
  return undefined;
}

function resolveShapeColor(
  element: TemplateElement,
  mods: Record<string, any>,
  compName: string | undefined,
  globalIndex: number
): { color: string; alpha: number } | undefined {
  const candidates: (string | undefined)[] = [];
  const elName = typeof element.name === "string" ? element.name : undefined;
  if (elName) {
    candidates.push(`${elName}.fill_color`, `${elName}.fillColor`);
    if (compName) {
      candidates.push(
        `${compName}.${elName}.fill_color`,
        `${compName}.${elName}.fillColor`
      );
    }
  }
  if (compName) {
    candidates.push(`${compName}.fill_color`, `${compName}.fillColor`);
  }
  if (globalIndex === 0) {
    candidates.push("Shape.fill_color", "Shape.fillColor");
  }
  candidates.push(`Shape-${globalIndex}.fill_color`, `Shape-${globalIndex}.fillColor`);
  if (globalIndex >= 1) {
    candidates.push(
      `Shape-${globalIndex - 1}.fill_color`,
      `Shape-${globalIndex - 1}.fillColor`
    );
  }

  let override: any;
  for (const key of candidates) {
    if (!key) continue;
    const val = mods[key];
    if (typeof val === "string" && val.trim()) {
      override = val;
      break;
    }
  }

  const baseRaw =
    override ?? (element as any)?.fill_color ?? (element as any)?.fillColor;
  const parsed = parseShapeColor(baseRaw);
  if (!parsed) return undefined;
  const op = parseAlpha((element as any)?.opacity);
  if (op != null && Number.isFinite(op)) {
    const clamped = Math.max(0, Math.min(1, op));
    parsed.alpha = Math.max(0, Math.min(1, parsed.alpha * clamped));
  }
  return parsed.alpha > 0 ? parsed : undefined;
}

function extractShapeAnimations(
  element: TemplateElement,
  rect: { width: number; height: number }
): AnimationSpec[] {
  const out: AnimationSpec[] = [];
  const anims = (element as any)?.animations;
  if (!Array.isArray(anims)) return out;
  for (const a of anims) {
    if (!a) continue;
    if ((a as any).reversed) continue;
    const rawTime = (a as any).time;
    if (typeof rawTime === "string" && rawTime.trim().toLowerCase() === "end") {
      continue;
    }
    const duration = parseSec((a as any).duration, 0);
    if (!(duration > 0)) continue;
    const time = parseSec(rawTime, 0);
    if (a.type === "fade") {
      out.push({ type: "fade", time, duration });
    } else if (a.type === "wipe") {
      const angle = parseAngleDeg((a as any).start_angle) ?? parseAngleDeg((a as any).end_angle);
      let dir: "wipeup" | "wipedown" | "wipeleft" | "wiperight" = "wipeup";
      if (typeof angle === "number" && Number.isFinite(angle)) {
        const norm = normalizeAngle(angle);
        if (Math.abs(norm - 90) < 1 || Math.abs(norm - 270) < 1) {
          const anchor =
            parsePercent((a as any).y_anchor) ?? parsePercent((element as any)?.y_anchor);
          if (anchor != null) {
            dir = anchor > 0.5 ? "wipedown" : "wipeup";
          } else {
            dir = Math.abs(norm - 270) < 1 ? "wipedown" : "wipeup";
          }
        } else {
          const anchor =
            parsePercent((a as any).x_anchor) ?? parsePercent((element as any)?.x_anchor);
          if (anchor != null) {
            dir = anchor > 0.5 ? "wipeleft" : "wiperight";
          } else {
            dir = Math.abs(norm - 180) < 1 ? "wipeleft" : "wiperight";
          }
        }
      } else {
        dir = rect.height >= rect.width ? "wipeup" : "wiperight";
      }
      out.push({ type: "wipe", time, duration, direction: dir });
    }
  }
  return out;
}

function extractShapesFromComposition(
  comp: TemplateElement | undefined,
  mods: Record<string, any>,
  W: number,
  H: number,
  startIndex: number
): ShapeBlockSpec[] {
  if (!comp || !Array.isArray(comp.elements)) return [];
  const queue: TemplateElement[] = [...comp.elements];
  const shapes: ShapeBlockSpec[] = [];
  while (queue.length) {
    const el = queue.shift();
    if (!el) continue;
    if ((el as any)?.visible === false) continue;
    if (Array.isArray((el as any)?.elements)) {
      queue.push(...(((el as any).elements as TemplateElement[]) || []));
    }
    const type = typeof el.type === "string" ? el.type.toLowerCase() : "";
    if (type !== "shape") continue;
    const fill = (el as any)?.fill_color ?? (el as any)?.fillColor;
    if (Array.isArray(fill)) continue;
    const widthPx = pctToPx((el as any)?.width, W);
    const heightPx = pctToPx((el as any)?.height, H);
    if (!(widthPx && widthPx > 0) || !(heightPx && heightPx > 0)) continue;
    const xPx = pctToPx((el as any)?.x, W);
    const yPx = pctToPx((el as any)?.y, H);
    if (xPx == null || yPx == null) continue;
    const anchorX = parsePercent((el as any)?.x_anchor) ?? 0;
    const anchorY = parsePercent((el as any)?.y_anchor) ?? 0;
    const rect = clampRect(
      xPx - widthPx * anchorX,
      yPx - heightPx * anchorY,
      widthPx,
      heightPx,
      W,
      H
    );
    if (!rect) continue;
    if (rect.w >= W * 0.98 && rect.h >= H * 0.98) continue;
    const globalIndex = startIndex + shapes.length;
    const color = resolveShapeColor(el, mods, comp.name, globalIndex);
    if (!color) continue;
    const animations = extractShapeAnimations(el, { width: rect.w, height: rect.h });
    shapes.push({
      x: rect.x,
      y: rect.y,
      width: rect.w,
      height: rect.h,
      color: color.color,
      alpha: color.alpha,
      animations: animations.length ? animations : undefined,
    });
  }
  return shapes;
}

function writeTextFilesForSlide(i: number, lines: string[]): string[] {
  ensureTempDir();
  return lines.map((txt, idx) => {
    const p = join(paths.temp, `dtxt-${String(i).padStart(3, "0")}-${idx}.txt`);
    writeFileSync(p, String(txt ?? ""), "utf8");
    return p;
  });
}

/* --- asset locali già scaricati da fetchAssets() --- */
function findImageForSlide(i: number): string | undefined {
  const b = paths.images;
  const cand = [
    join(b, `img${i}.jpeg`),
    join(b, `img${i}.jpg`),
    join(b, `img${i}.png`),
  ];
  return cand.find(existsSync);
}
function findTTSForSlide(i: number): string | undefined {
  const b = paths.tts;
  const cand = [join(b, `tts-${i}.mp3`)];
  return cand.find(existsSync);
}

function findFontPath(family: string): string | undefined {
  try {
    const matches = readdirSync(paths.fonts)
      .filter((f) => fileNameMatchesFamily(f, family))
      .sort((a, b) => a.localeCompare(b));
    if (!matches.length) return undefined;
    return join(paths.fonts, matches[0]);
  } catch {}
  return undefined;
}

/* ---------- fallback testo se il template manca lo slot ---------- */
function defaultTextBlock(x = 120, y = 160): TextBlockSpec {
  return {
    x, y,
    fontSize: 60,
    fontColor: "white",
    lineSpacing: 8,
    box: false,
  };
}

/**
 * Ricava posizione e dimensioni del blocco di testo "Testo-i".
 * Restituisce coordinate del punto in alto a sinistra (clampate) e larghezza/
 * altezza in px.
 */
export function getTextBoxFromTemplate(
  tpl: TemplateDoc,
  slideIndexOrName: number | string,
  textName?: string
): { x: number; y: number; w: number; h: number } | undefined {
  const compName =
    typeof slideIndexOrName === "number"
      ? `Slide_${slideIndexOrName}`
      : slideIndexOrName;
  const txtName =
    textName ??
    (typeof slideIndexOrName === "number" ? `Testo-${slideIndexOrName}` : undefined);
  const comp = findComposition(tpl, compName);
  const txtEl = txtName ? findChildByName(comp, txtName) : undefined;
  if (!comp || !txtEl) return undefined;

  const W = tpl.width,
    H = tpl.height;

  const x = pctToPx(txtEl.x, W);
  const y = pctToPx(txtEl.y, H);
  if (typeof x !== "number" || typeof y !== "number") return undefined;

  const w = pctToPx(txtEl.width, W) || 0;
  const h = pctToPx(txtEl.height, H) || 0;
  const xAnchor = (pctToPx(txtEl.x_anchor, 100) || 0) / 100;
  const yAnchor = (pctToPx(txtEl.y_anchor, 100) || 0) / 100;

  let left = x - w * xAnchor;
  let top = y - h * yAnchor;

  if (w > 0) left = Math.max(0, Math.min(W - w, left));
  else left = Math.max(0, Math.min(W - 10, left));
  if (h > 0) top = Math.max(0, Math.min(H - h, top));
  else top = Math.max(0, Math.min(H - 10, top));

  return { x: Math.round(left), y: Math.round(top), w: Math.round(w), h: Math.round(h) };
}

/** Ricava posizione e dimensione del logo dalla composition "Slide_i" */
export function getLogoBoxFromTemplate(
  tpl: TemplateDoc,
  slideIndexOrName: number | string,
  logoName = "Logo"
): { x?: number; y?: number; w?: number; h?: number } {
  const compName =
    typeof slideIndexOrName === "number"
      ? `Slide_${slideIndexOrName}`
      : slideIndexOrName;
  const comp = findComposition(tpl, compName);
  const lg = findChildByName(comp, logoName);
  if (!comp || !lg) return {};
  const W = tpl.width,
    H = tpl.height;
  const x = pctToPx(lg.x, W);
  const y = pctToPx(lg.y, H);
  const w = pctToPx(lg.width, W) || 0;
  const h = pctToPx(lg.height, H) || 0;
  const xAnchor = (pctToPx(lg.x_anchor, 100) || 50) / 100;
  const yAnchor = (pctToPx(lg.y_anchor, 100) || 50) / 100;

  let left = typeof x === "number" ? x - w * xAnchor : undefined;
  let top = typeof y === "number" ? y - h * yAnchor : undefined;

  if (typeof left === "number") {
    left = Math.max(0, Math.min(W - w, left));
  }
  if (typeof top === "number") {
    top = Math.max(0, Math.min(H - h, top));
  }

  return {
    x: typeof left === "number" ? Math.round(left) : undefined,
    y: typeof top === "number" ? Math.round(top) : undefined,
    w: w > 0 ? Math.round(w) : undefined,
    h: h > 0 ? Math.round(h) : undefined,
  };
}

export function getFontFamilyFromTemplate(
  tpl: TemplateDoc,
  slideIndexOrName: number | string,
  textName?: string
): string | undefined {
  const compName =
    typeof slideIndexOrName === "number"
      ? `Slide_${slideIndexOrName}`
      : slideIndexOrName;
  const txtName =
    textName ??
    (typeof slideIndexOrName === "number" ? `Testo-${slideIndexOrName}` : undefined);
  const comp = findComposition(tpl, compName);
  const txtEl = txtName ? (findChildByName(comp, txtName) as any) : undefined;
  const fam = txtEl?.font_family;
  return typeof fam === "string" ? fam : undefined;
}

const DEFAULT_CHARS_PER_LINE = 40;
const APPROX_CHAR_WIDTH_RATIO = 0.56;
const MIN_FONT_SIZE = 24;
const MAX_FONT_LAYOUT_ITERATIONS = 6;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function parseAlignmentFactor(raw: any): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const normalized = raw > 1 ? raw / 100 : raw;
    return clamp01(normalized);
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.endsWith("%")) {
    const n = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(n) ? clamp01(n / 100) : undefined;
  }
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return clamp01(n > 1 ? n / 100 : n);
}

function maxCharsForWidth(width: number, fontSize: number): number {
  if (!(width > 0) || !(fontSize > 0)) return DEFAULT_CHARS_PER_LINE;
  const approxChar = fontSize * APPROX_CHAR_WIDTH_RATIO;
  if (!(approxChar > 0)) return DEFAULT_CHARS_PER_LINE;
  const maxChars = Math.floor(width / approxChar);
  return Math.max(1, maxChars || 0);
}

function parseLineHeightFactor(raw: any): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw <= 0) return undefined;
    return raw > 10 ? raw / 100 : raw;
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.endsWith("%")) {
    const n = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : undefined;
  }
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return n > 10 ? n / 100 : n;
}

export function wrapText(text: string, maxPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxPerLine && line) {
      lines.push(line);
      line = w;
    } else if (candidate.length > maxPerLine) {
      lines.push(w);
      line = "";
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function linesEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

type TextLayoutResult = { lines: string[]; font: number; spacing: number };

function resolveTextLayout(
  text: string,
  box: { w?: number; h?: number },
  initialFont: number,
  lineHeightFactor: number
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

  for (let iter = 0; iter < MAX_FONT_LAYOUT_ITERATIONS; iter++) {
    const maxChars = width > 0 ? maxCharsForWidth(width, fontGuess) : DEFAULT_CHARS_PER_LINE;
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
          widthFont = Math.max(MIN_FONT_SIZE, approx);
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
    const maxChars = width > 0 ? maxCharsForWidth(width, candidate.font) : DEFAULT_CHARS_PER_LINE;
    const recomputed = wrapText(text, maxChars);
    if (linesEqual(recomputed, candidate.lines)) {
      return candidate;
    }
  }

  return layouts[layouts.length - 1];
}

function isExplicitlyFalse(value: unknown): boolean {
  if (value === false) return true;
  if (value === 0) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off";
  }
  return false;
}

function buildCopyrightBlock(
  template: TemplateDoc,
  mods: Record<string, any>,
  compName: string,
  elementName: string,
  videoW: number,
  videoH: number
): TextBlockSpec | undefined {
  const comp = findComposition(template, compName);
  const element = findChildByName(comp, elementName) as TemplateElement | undefined;
  if (!comp || !element) return undefined;
  if ((element as any)?.visible === false) return undefined;
  const visMod = mods?.[`${elementName}.visible`];
  if (isExplicitlyFalse(visMod)) return undefined;

  const modValue = mods?.[elementName];
  const modText = typeof modValue === "string" ? modValue.trim() : "";
  const tplText = typeof (element as any)?.text === "string" ? (element as any).text.trim() : "";
  const text = modText || tplText;
  if (!text) return undefined;

  const box = getTextBoxFromTemplate(template, compName, elementName);
  if (!box) return undefined;

  const explicitFont = lenToPx((element as any)?.font_size, videoW, videoH);
  const minFontPx = lenToPx((element as any)?.font_size_minimum, videoW, videoH);
  const maxFontPx = lenToPx((element as any)?.font_size_maximum, videoW, videoH);
  const clampFontSize = (value: number): number => {
    let next = Number.isFinite(value) && value > 0 ? value : MIN_FONT_SIZE;
    if (typeof maxFontPx === "number" && Number.isFinite(maxFontPx) && maxFontPx > 0) {
      next = Math.min(next, maxFontPx);
    }
    if (typeof minFontPx === "number" && Number.isFinite(minFontPx) && minFontPx > 0) {
      next = Math.max(next, minFontPx);
    }
    if (!(next > 0)) next = MIN_FONT_SIZE;
    return Math.max(MIN_FONT_SIZE, Math.round(next));
  };

  let fontGuess = explicitFont ?? minFontPx ?? maxFontPx ?? MIN_FONT_SIZE;
  if (!(fontGuess > 0)) fontGuess = MIN_FONT_SIZE;
  fontGuess = clampFontSize(fontGuess);

  const lineHeightFactor = parseLineHeightFactor((element as any)?.line_height) ?? 1.2;

  const manualBreaks = text.includes("\n");
  let lines = manualBreaks
    ? text.split(/\r?\n/)
    : wrapText(
        text,
        box.w > 0 ? maxCharsForWidth(box.w, Math.round(fontGuess)) : DEFAULT_CHARS_PER_LINE
      );
  lines = lines.map((ln) => ln.trim()).filter((ln) => ln);
  if (!lines.length) return undefined;

  const computeSpacing = (font: number, lineCount: number): number => {
    const safeLines = Math.max(1, lineCount);
    const lineHeightPx = box.h > 0 ? box.h / safeLines : font * lineHeightFactor;
    const targetSpacing = Math.round(font * Math.max(0, lineHeightFactor - 1));
    const availableSpacing = Math.round(Math.max(0, lineHeightPx - font));
    return Math.min(targetSpacing, availableSpacing);
  };

  let fontSize = clampFontSize(fontGuess);
  let spacing = computeSpacing(fontSize, lines.length);
  if (!manualBreaks) {
    const layout = resolveTextLayout(text, box, fontSize, lineHeightFactor);
    if (layout) {
      lines = [...layout.lines];
      fontSize = clampFontSize(layout.font);
      spacing = computeSpacing(fontSize, lines.length);
    }
  }

  const alignY = parseAlignmentFactor((element as any)?.y_alignment) ?? 0;
  let y = box.y;
  if (lines.length && box.h > 0) {
    const usedHeight = fontSize * lines.length + spacing * Math.max(0, lines.length - 1);
    if (usedHeight > 0) {
      const free = box.h - usedHeight;
      if (free > 0 && alignY > 0) {
        const offset = Math.round(Math.min(free, Math.max(0, free * alignY)));
        y = box.y + offset;
      }
    }
  }

  const rawPadX = lenToPx((element as any)?.x_padding, videoW, videoH) ?? 0;
  const rawPadY = lenToPx((element as any)?.y_padding, videoW, videoH) ?? 0;
  const padX = Math.max(0, rawPadX);
  const padY = Math.max(0, rawPadY);
  const pad = Math.max(0, Math.round(Math.max(padX, padY)));

  const fill = parseRGBA((element as any)?.fill_color);
  const bg = parseRGBA((element as any)?.background_color);

  const fontFamily = getFontFamilyFromTemplate(template, compName, elementName);
  const fontPath = fontFamily ? findFontPath(fontFamily) : undefined;

  const block: TextBlockSpec = {
    x: box.x,
    y,
    text: lines.join("\n"),
    fontFile: fontPath,
    fontSize,
    fontColor: fill?.color ?? "#ffffff",
    lineSpacing: spacing,
  };

  if (bg) {
    const approxCharWidth = fontSize * APPROX_CHAR_WIDTH_RATIO;
    const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
    let textWidth =
      longestLine > 0 && approxCharWidth > 0
        ? longestLine * approxCharWidth
        : approxCharWidth;
    if (!(textWidth > 0)) {
      textWidth = fontSize;
    }
    const maxAllowedWidth = box.w && box.w > 0 ? box.w : textWidth;
    textWidth = Math.min(textWidth, maxAllowedWidth);
    const lineCount = lines.length || 1;
    const totalSpacing = Math.max(0, lineCount - 1) * Math.max(0, spacing);
    const textHeight = fontSize * lineCount + totalSpacing;
    const rect = clampRect(
      block.x - padX,
      y - padY,
      textWidth + padX * 2,
      textHeight + padY * 2,
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
  }

  const wantsBox = !block.background && (!!bg || pad > 0);
  if (wantsBox) {
    block.box = true;
    block.boxColor = bg?.color ?? block.boxColor ?? "#000000";
    block.boxAlpha = bg?.alpha ?? block.boxAlpha ?? 0;
    if (pad > 0) {
      block.boxBorderW = pad;
    }
  }

  return block;
}

/* ============================================================
   COSTRUTTORE SLIDE
   - Legge contenuti da 'mods'
   - Prende posizioni (testo/logo) dal template
   ============================================================ */
export function buildTimelineFromLayout(
  modifications: Record<string, any>,
  template: TemplateDoc,
  opts: { videoW: number; videoH: number; fps: number; defaultDur?: number }
): SlideSpec[] {
  const { videoW, videoH, fps, defaultDur = 7 } = opts;
  const mods = modifications || {};

  // Numero di slide: oltre a testo/tts/immagini, consideriamo anche le
  // occorrenze `Slide_i.time` nelle modifications per includere eventuali
  // filler definiti solo nel template.
  let maxIdx = -1;
  const slideTimeRe = /^Slide_(\d+)\.time$/;
  for (const k of Object.keys(mods)) {
    const m = k.match(slideTimeRe);
    if (m) maxIdx = Math.max(maxIdx, Number(m[1]));
  }
  for (let i = 0; i < 50; i++) {
    const hasTxt = typeof mods[`Testo-${i}`] === "string" && mods[`Testo-${i}`].trim() !== "";
    const hasTTS = !!mods[`TTS-${i}`] || !!findTTSForSlide(i);
    const hasImg = !!mods[`Immagine-${i}`] || !!findImageForSlide(i);
    if (hasTxt || hasTTS || hasImg) maxIdx = Math.max(maxIdx, i);
  }
  const n = Math.max(0, maxIdx + 1);

  const slides: SlideSpec[] = [];
  let prevEnd = 0;
  let globalShapeIndex = 0;

  for (let i = 0; i < n; i++) {
    const comp = findComposition(template, `Slide_${i}`);
    const txtEl = findChildByName(comp, `Testo-${i}`);
    const visMod = mods[`Slide_${i}.visible`];
    const isVisible =
      !(
        visMod === false ||
        visMod === 0 ||
        String(visMod).toLowerCase() === "false" ||
        comp?.visible === false
      );
    if (!isVisible) continue;

    const start = parseSec(mods[`Slide_${i}.time`], prevEnd);

    // Inserisci filler se c'è un gap rispetto alla fine precedente
    if (start > prevEnd + 0.001) {
      const gap = start - prevEnd;
      const fLogo = getLogoBoxFromTemplate(template, i) || {
        x: Math.round((videoW - 240) / 2),
        y: Math.round((videoH - 140) / 2),
        w: 240,
        h: 140,
      };
      slides.push({
        width: videoW,
        height: videoH,
        fps,
        durationSec: gap,
        outPath: "",
        logoPath: join(paths.images, "logo.png"),
        logoWidth: fLogo.w,
        logoHeight: fLogo.h,
        logoX: fLogo.x,
        logoY: fLogo.y,
        backgroundAnimated: false,
      });
      prevEnd = start;
    }

    let slideDur = parseSec(
      mods[`Slide_${i}.duration`],
      parseSec(comp?.duration, defaultDur)
    );

    const ttsPath = findTTSForSlide(i);
    let ttsDur = parseSec(mods[`TTS-${i}.duration`], 0);
    if (!ttsDur && ttsPath) ttsDur = probeDurationSec(ttsPath);
    if (ttsDur > slideDur) slideDur = ttsDur;

    const txtStr = typeof mods[`Testo-${i}`] === "string" ? mods[`Testo-${i}`].trim() : "";

    const txtBox = getTextBoxFromTemplate(template, i) || { x: 120, y: 160, w: 0, h: 0 };
    const baseBlock = defaultTextBlock(txtBox.x, txtBox.y);
    if (txtEl) {
      const bg = parseRGBA((txtEl as any).background_color);
      if (bg) {
        const padX =
          lenToPx((txtEl as any)?.x_padding, videoW, videoH) ?? 0;
        const padY =
          lenToPx((txtEl as any)?.y_padding, videoW, videoH) ?? 0;
        const rect = clampRect(
          txtBox.x - padX,
          txtBox.y - padY,
          txtBox.w > 0 ? txtBox.w + padX * 2 : 0,
          txtBox.h > 0 ? txtBox.h + padY * 2 : 0,
          videoW,
          videoH
        );
        if (rect) {
          baseBlock.background = {
            x: rect.x,
            y: rect.y,
            width: rect.w,
            height: rect.h,
            color: bg.color,
            alpha: bg.alpha,
          };
        }
        baseBlock.box = true;
        baseBlock.boxColor = bg.color;
        baseBlock.boxAlpha = bg.alpha;
        const pad = Math.round(Math.max(padX, padY));
        if (pad > 0) {
          baseBlock.boxBorderW = pad;
        }
      }
    }

    const initialFontSize = baseBlock.fontSize ?? 60;
    const initialMaxChars =
      txtBox.w > 0 ? maxCharsForWidth(txtBox.w, initialFontSize) : DEFAULT_CHARS_PER_LINE;
    let lines = txtStr ? wrapText(txtStr, initialMaxChars) : [];
    const lineHeightFactor =
      parseLineHeightFactor((txtEl as any)?.line_height) ?? 1.35;

    if (lines.length) {
      const layout = resolveTextLayout(
        txtStr,
        txtBox,
        baseBlock.fontSize ?? initialFontSize,
        lineHeightFactor
      );
      if (layout) {
        lines = [...layout.lines];
        baseBlock.fontSize = layout.font;
        baseBlock.lineSpacing = layout.spacing;
      }

      applyExtraBackgroundPadding(
        baseBlock,
        baseBlock.fontSize ?? initialFontSize,
        videoW,
        videoH
      );
    }

    const alignY = parseAlignmentFactor((txtEl as any)?.y_alignment) ?? 0;
    baseBlock.y = txtBox.y;
    if (lines.length && txtBox.h > 0) {
      const font = baseBlock.fontSize ?? initialFontSize;
      const spacing = baseBlock.lineSpacing ?? 0;
      const usedHeight = font * lines.length + spacing * Math.max(0, lines.length - 1);
      if (usedHeight > 0) {
        const free = txtBox.h - usedHeight;
        if (free > 0 && alignY > 0) {
          const offset = Math.round(Math.min(free, Math.max(0, free * alignY)));
          baseBlock.y = txtBox.y + offset;
        }
      }
    }

    const textFiles = lines.length ? writeTextFilesForSlide(i, lines) : [];

    // Animazioni per ciascuna linea
    const lineHeight = (baseBlock.fontSize ?? 60) + (baseBlock.lineSpacing ?? 8);
    const perLineAnims: AnimationSpec[][] = textFiles.map(() => []);
    const anims = (txtEl as any)?.animations;
    if (Array.isArray(anims)) {
      for (const a of anims) {
        const dur = parseSec(a.duration, 0);
        if (
          a.type === "fade" &&
          dur > 0 &&
          a.reversed !== true &&
          String(a.time) !== "end"
        ) {
          const t = parseSec(a.time, 0);
          for (const arr of perLineAnims) {
            arr.push({ type: "fade", time: t, duration: dur });
          }
        }
      }
      const tr = anims.find(
        (a: any) => a.type === "text-reveal" && a.split === "line"
      );
      if (tr) {
        const dir =
          tr.axis === "y"
            ? (String(tr.y_anchor ?? "").trim() === "100%" ? "wipedown" : "wipeup")
            : (String(tr.x_anchor ?? "").trim() === "100%" ? "wipeleft" : "wiperight");
        for (let li = 0; li < perLineAnims.length; li++) {
          perLineAnims[li].push({
            type: "wipe",
            time: li * LINE_WIPE_DURATION,
            duration: LINE_WIPE_DURATION,
            direction: dir,
          });
        }
      }
    }

    const logoBox = getLogoBoxFromTemplate(template, i);
    const fontFamily = getFontFamilyFromTemplate(template, i);
    const fontPath = fontFamily ? findFontPath(fontFamily) : undefined;

    const bgShadowCandidates = slideBackgroundNameCandidates(i);
    const slideShadowSources: Array<() => ShadowInfo | undefined> = [
      () => extractShadow(comp, videoW, videoH),
      () => extractShadow(findShadowSource(comp, bgShadowCandidates), videoW, videoH),
      () => extractShadowFromMods(mods, `Slide_${i}`, videoW, videoH),
      ...bgShadowCandidates.map(
        (name) => () => extractShadowFromMods(mods, name, videoW, videoH)
      ),
    ];
    const slideHasShadow = slideShadowSources.some((get) => !!get());

    const bgImagePath = findImageForSlide(i);

    const backgroundRect = baseBlock.background;
    const shapes = extractShapesFromComposition(
      comp,
      mods,
      videoW,
      videoH,
      globalShapeIndex
    );
    globalShapeIndex += shapes.length;
    const texts: TextBlockSpec[] = textFiles.map((tf, idx) => ({
      ...baseBlock,
      background: idx === 0 ? backgroundRect : undefined,
      y: baseBlock.y + idx * lineHeight,
      textFile: tf,
      animations: perLineAnims[idx].length ? perLineAnims[idx] : undefined,
    }));

    const copyrightBlock = buildCopyrightBlock(
      template,
      mods,
      `Slide_${i}`,
      `Copyright-${i}`,
      videoW,
      videoH
    );
    if (copyrightBlock) {
      texts.push(copyrightBlock);
    }

    const isFillerSlide = !ttsPath && !txtStr && texts.length === 0;

    const slide: SlideSpec = {
      width: videoW,
      height: videoH,
      fps,
      durationSec: slideDur,
      outPath: "",

      bgImagePath,
      logoPath: join(paths.images, "logo.png"),
      ttsPath,

      fontFile: fontPath,

      logoWidth: logoBox.w ?? 240,
      logoHeight: logoBox.h ?? 140,
      logoX: logoBox.x ?? 161,
      logoY: logoBox.y ?? 713,

      texts: texts.length ? texts : undefined,

      shapes: shapes.length ? shapes : undefined,

      shadowEnabled: slideHasShadow ? true : undefined,
    };

    if (isFillerSlide) {
      slide.backgroundAnimated = false;
    } else if (bgImagePath && i > 0) {
      slide.backgroundAnimated = true;
    }

    if (process.env.DEBUG_TIMELINE) {
      console.log(
        `[timeline] slide ${i} -> img=${!!slide.bgImagePath} tts=${!!slide.ttsPath} text=${
          txtStr ? "✓" : "—"
        } dur=${slideDur}s`
      );
    }

    slides.push(slide);
    prevEnd = start + slideDur;
  }

  // Outro
  const outroComp = findComposition(template, "Outro");
  const outroVisMod = mods["Outro.visible"];
  const outroVisible =
    outroComp &&
    !(
      outroVisMod === false ||
      outroVisMod === 0 ||
      String(outroVisMod).toLowerCase() === "false" ||
      outroComp.visible === false
    );
  if (outroVisible) {
    const outroStart = parseSec(mods["Outro.time"], prevEnd);
    if (outroStart > prevEnd + 0.001) {
      const gap = outroStart - prevEnd;
      const fLogo = getLogoBoxFromTemplate(template, "Outro") || {
        x: Math.round((videoW - 240) / 2),
        y: Math.round((videoH - 140) / 2),
        w: 240,
        h: 140,
      };
      slides.push({
        width: videoW,
        height: videoH,
        fps,
        durationSec: gap,
        outPath: "",
        logoPath: join(paths.images, "logo.png"),
        logoWidth: fLogo.w,
        logoHeight: fLogo.h,
        logoX: fLogo.x,
        logoY: fLogo.y,
      });
      prevEnd = outroStart;
    }

    const outDur = parseSec(
      mods["Outro.duration"],
      parseSec(outroComp.duration, defaultDur)
    );
    const logoBox = getLogoBoxFromTemplate(template, "Outro");
    const textEl = findChildByName(outroComp, "Testo-outro") as any;
    const textBox = getTextBoxFromTemplate(template, "Outro", "Testo-outro");
    const fontFam = getFontFamilyFromTemplate(template, "Outro", "Testo-outro");
    const fontPath = fontFam ? findFontPath(fontFam) : undefined;
    const outroBgNames = outroBackgroundNameCandidates();
    const outroShadowSources: Array<() => ShadowInfo | undefined> = [
      () => extractShadow(outroComp, videoW, videoH),
      () => extractShadow(findShadowSource(outroComp, outroBgNames), videoW, videoH),
      () => extractShadowFromMods(mods, "Outro", videoW, videoH),
      ...outroBgNames.map(
        (name) => () => extractShadowFromMods(mods, name, videoW, videoH)
      ),
    ];
    const outroHasShadow = outroShadowSources.some((get) => !!get());
    const txt = textEl?.text as string | undefined;
    let texts: TextBlockSpec[] | undefined;
    if (txt && textBox) {
      const baseOut = defaultTextBlock(textBox.x, textBox.y);
      const bg = parseRGBA(textEl?.background_color);
      if (bg) {
        const padX = lenToPx(textEl?.x_padding, videoW, videoH) ?? 0;
        const padY = lenToPx(textEl?.y_padding, videoW, videoH) ?? 0;
        const rect = clampRect(
          textBox.x - padX,
          textBox.y - padY,
          textBox.w > 0 ? textBox.w + padX * 2 : 0,
          textBox.h > 0 ? textBox.h + padY * 2 : 0,
          videoW,
          videoH
        );
        if (rect) {
          baseOut.background = {
            x: rect.x,
            y: rect.y,
            width: rect.w,
            height: rect.h,
            color: bg.color,
            alpha: bg.alpha,
          };
          baseOut.box = false;
        } else {
          baseOut.box = true;
          baseOut.boxColor = bg.color;
          baseOut.boxAlpha = bg.alpha;
        }
      }
      const initialOutSize = baseOut.fontSize ?? 60;
      const initialOutMax =
        textBox.w > 0 ? maxCharsForWidth(textBox.w, initialOutSize) : DEFAULT_CHARS_PER_LINE;
      let linesOut = wrapText(txt, initialOutMax);
      const lineHeightFactorOut =
        parseLineHeightFactor(textEl?.line_height) ?? 1.35;

      if (linesOut.length) {
        const layout = resolveTextLayout(
          txt,
          textBox,
          baseOut.fontSize ?? initialOutSize,
          lineHeightFactorOut
        );
        if (layout) {
          linesOut = [...layout.lines];
          baseOut.fontSize = layout.font;
          baseOut.lineSpacing = layout.spacing;
        }

        applyExtraBackgroundPadding(
          baseOut,
          baseOut.fontSize ?? initialOutSize,
          videoW,
          videoH
        );
      }

      const alignY = parseAlignmentFactor(textEl?.y_alignment) ?? 0;
      baseOut.y = textBox.y;
      if (linesOut.length && textBox.h > 0) {
        const font = baseOut.fontSize ?? initialOutSize;
        const spacing = baseOut.lineSpacing ?? 0;
        const usedHeight = font * linesOut.length + spacing * Math.max(0, linesOut.length - 1);
        if (usedHeight > 0) {
          const free = textBox.h - usedHeight;
          if (free > 0 && alignY > 0) {
            const offset = Math.round(Math.min(free, Math.max(0, free * alignY)));
            baseOut.y = textBox.y + offset;
          }
        }
      }

      const txtFiles = writeTextFilesForSlide(slides.length, linesOut);
      const lineH = (baseOut.fontSize ?? 60) + (baseOut.lineSpacing ?? 8);
      const perLine: AnimationSpec[][] = txtFiles.map(() => []);
      const anims = textEl?.animations;
      if (Array.isArray(anims)) {
        for (const a of anims) {
          const dur = parseSec(a.duration, 0);
          if (
            a.type === "fade" &&
            dur > 0 &&
            a.reversed !== true &&
            String(a.time) !== "end"
          ) {
            const t = parseSec(a.time, 0);
            for (const arr of perLine) {
              arr.push({ type: "fade", time: t, duration: dur });
            }
          }
        }
        const tr = anims.find(
          (a: any) => a.type === "text-reveal" && a.split === "line"
        );
        if (tr) {
          const dir =
            tr.axis === "y"
              ? (String(tr.y_anchor ?? "").trim() === "100%" ? "wipedown" : "wipeup")
              : (String(tr.x_anchor ?? "").trim() === "100%" ? "wipeleft" : "wiperight");
          for (let li = 0; li < perLine.length; li++) {
            perLine[li].push({
              type: "wipe",
              time: li * LINE_WIPE_DURATION,
              duration: LINE_WIPE_DURATION,
              direction: dir,
            });
          }
        }
      }
      const outroBackground = baseOut.background;
      texts = txtFiles.map((tf, idx) => ({
        ...baseOut,
        background: idx === 0 ? outroBackground : undefined,
        y: baseOut.y + idx * lineH,
        textFile: tf,
        animations: perLine[idx].length ? perLine[idx] : undefined,
      }));
    }
    const outroCopyright = buildCopyrightBlock(
      template,
      mods,
      "Outro",
      "Copyright-outro",
      videoW,
      videoH
    );
    if (outroCopyright) {
      if (!texts) texts = [];
      texts.push(outroCopyright);
    }
    slides.push({
      width: videoW,
      height: videoH,
      fps,
      durationSec: outDur,
      outPath: "",
      logoPath: join(paths.images, "logo.png"),
      logoWidth: logoBox.w ?? 240,
      logoHeight: logoBox.h ?? 140,
      logoX: logoBox.x ?? Math.round((videoW - (logoBox.w ?? 240)) / 2),
      logoY: logoBox.y ?? Math.round((videoH - (logoBox.h ?? 140)) / 2),
      fontFile: fontPath,
      texts,
      shadowEnabled: outroHasShadow ? true : undefined,
    });
  }

  return slides;
}
