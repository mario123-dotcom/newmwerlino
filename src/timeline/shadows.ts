import type { TemplateElement } from "../template";
import { findChildByName } from "../template";
import type { ShadowInfo } from "./types";
import {
  lenToPx,
  parseAlpha,
  parseShadowColor,
  parseShadowLength,
  uniqueNames,
} from "./utils";

export type { ShadowInfo } from "./types";

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
  width: number,
  height: number
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

  const widthPx = lenToPx((source as any)?.width, width, height);
  const heightPx = lenToPx((source as any)?.height, width, height);
  if (typeof widthPx === "number" && Number.isFinite(widthPx) && widthPx > 0) {
    info.w = widthPx;
  }
  if (typeof heightPx === "number" && Number.isFinite(heightPx) && heightPx > 0) {
    info.h = heightPx;
  }
  if (info.w === undefined) info.w = width;
  if (info.h === undefined) info.h = height;

  const opacity = parseAlpha((source as any)?.opacity);
  if (opacity !== undefined) {
    const base = info.alpha ?? 1;
    info.alpha = Math.max(0, Math.min(1, base * opacity));
  }

  return info;
}

function extractShadowFromElementProps(
  source: TemplateElement,
  width: number,
  height: number
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

  const sw = parseShadowLength(rawX, "x", width, height);
  if (typeof sw === "number" && Number.isFinite(sw)) info.w = sw;
  const sh = parseShadowLength(rawY, "y", width, height);
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

function readShadowMod(mods: Record<string, any>, prefix: string, keys: string[]): any {
  for (const key of keys) {
    const full = `${prefix}.${key}`;
    if (mods[full] !== undefined) return mods[full];
  }
  return undefined;
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

export function extractShadowFromMods(
  mods: Record<string, any>,
  prefix: string,
  width: number,
  height: number
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

  const sw = parseShadowLength(rawX, "x", width, height);
  if (typeof sw === "number" && Number.isFinite(sw)) info.w = sw;
  const sh = parseShadowLength(rawY, "y", width, height);
  if (typeof sh === "number" && Number.isFinite(sh)) info.h = sh;

  return info;
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

export function findShadowSource(
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

export function extractShadow(
  source: TemplateElement | undefined,
  width: number,
  height: number
): ShadowInfo | undefined {
  if (!source) return undefined;
  if (!isShadowCandidate(source)) return undefined;
  const merged = mergeShadows(
    extractGradientShadow(source, width, height),
    extractShadowFromElementProps(source, width, height)
  );
  if (merged.declared) return merged;
  return hasShadowHintElement(source) ? { declared: true } : undefined;
}

export function slideBackgroundNameCandidates(index: number): string[] {
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

export function outroBackgroundNameCandidates(): string[] {
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
