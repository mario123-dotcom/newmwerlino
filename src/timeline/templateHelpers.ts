import type { TemplateDoc, TemplateElement } from "../template";
import { findChildByName, findComposition, pctToPx } from "../template";
import { parseRGBA } from "./utils";
import { clampRect, lenToPx } from "./utils";
import { findFontPath } from "./assets";
import type { TextBlockSpec } from "./types";
import {
  applyExtraBackgroundPadding,
  applyHorizontalAlignment,
  computeLineSpacingForBox,
  computeWidthScaleFromTemplate,
  deriveFontSizing,
  fitTextWithTargetFont,
  maxCharsForWidth,
  parseAlignmentFactor,
  parseLetterSpacing,
  parseLineHeightFactor,
  resolveTextLayout,
  wrapText,
} from "./text";
import { APPROX_CHAR_WIDTH_RATIO, DEFAULT_CHARS_PER_LINE, MIN_FONT_SIZE } from "./constants";

/**
 * Restituisce i parametri base di un blocco testo (posizione e stile neutro).
 *
 * @param x Coordinata X iniziale.
 * @param y Coordinata Y iniziale.
 * @returns Blocco testo con valori di default.
 */
export function defaultTextBlock(x = 120, y = 160): TextBlockSpec {
  return {
    x,
    y,
    fontSize: 70,
    fontColor: "white",
    lineSpacing: 8,
    box: false,
  };
}

/**
 * Recupera dal template il box dedicato al testo di una slide, traducendo
 * valori percentuali in pixel e gestendo ancore/origini.
 *
 * @param tpl Documento Creatomate.
 * @param slideIndexOrName Indice numerico o nome della composition.
 * @param textName Nome dell'elemento testo (fallback a Testo-<index>).
 * @param opts Opzioni per preservare anchor/origine e larghezza minima.
 * @returns Box con coordinate e dimensioni in pixel, se disponibile.
 */
export function getTextBoxFromTemplate(
  tpl: TemplateDoc,
  slideIndexOrName: number | string,
  textName?: string,
  opts?: {
    preserveAnchor?: boolean;
    preserveOrigin?: boolean;
    minWidthRatio?: number;
  }
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

  const W = tpl.width;
  const H = tpl.height;

  const x = pctToPx(txtEl.x, W);
  const y = pctToPx(txtEl.y, H);
  if (typeof x !== "number" || typeof y !== "number") return undefined;

  const rawW = pctToPx(txtEl.width, W) || 0;
  const rawH = pctToPx(txtEl.height, H) || 0;
  let w = rawW;
  let h = rawH;

  const normAnchor = (value: number | undefined): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value <= 1) return value;
    const ratio = value / 100;
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    return ratio;
  };

  const xAnchor = normAnchor(pctToPx(txtEl.x_anchor, 100));
  const yAnchor = normAnchor(pctToPx(txtEl.y_anchor, 100));

  const baseLeft = x - rawW * xAnchor;
  const baseTop = y - rawH * yAnchor;

  if (!(w > 0)) {
    const mirrorLeft = Math.max(0, Math.min(W, baseLeft));
    const mirrorWidth = W - mirrorLeft * 2;
    if (mirrorWidth > 0) {
      w = mirrorWidth;
    }
  }
  if (!(h > 0)) {
    const mirrorTop = Math.max(0, Math.min(H, baseTop));
    const mirrorHeight = H - mirrorTop * 2;
    if (mirrorHeight > 0) {
      h = mirrorHeight;
    }
  }

  const rawMinRatio = opts?.minWidthRatio;
  if (W > 0 && Number.isFinite(W)) {
    const minRatio =
      typeof rawMinRatio === "number" && Number.isFinite(rawMinRatio)
        ? Math.max(0, Math.min(rawMinRatio, 1))
        : undefined;
    if (typeof minRatio === "number" && minRatio > 0) {
      const minWidth = Math.round(W * minRatio);
      if (minWidth > 0) {
        const widthTarget = Math.min(W, minWidth);
        if (!(w > 0) || w < widthTarget) {
          w = widthTarget;
        }
      }
    }
  }

  const preserveAnchor = opts?.preserveAnchor === true;
  const preserveOrigin = !preserveAnchor && opts?.preserveOrigin === true;

  const desiredLeft =
    preserveAnchor || !(rawW > 0)
      ? x - w * xAnchor
      : preserveOrigin
      ? baseLeft
      : x - w * xAnchor;
  const desiredTop =
    preserveAnchor || !(rawH > 0)
      ? y - h * yAnchor
      : preserveOrigin
      ? baseTop
      : y - h * yAnchor;

  let left = desiredLeft;
  let top = desiredTop;

  if (w > 0) left = Math.max(0, Math.min(W - w, left));
  else left = Math.max(0, Math.min(W - 10, left));
  if (h > 0) top = Math.max(0, Math.min(H - h, top));
  else top = Math.max(0, Math.min(H - 10, top));

  return { x: Math.round(left), y: Math.round(top), w: Math.round(w), h: Math.round(h) };
}

/**
 * Ricava posizione e dimensioni del logo da una composition o slide.
 *
 * @param tpl Documento template.
 * @param slideIndexOrName Indice o nome della slide di riferimento.
 * @param logoName Nome dell'elemento logo (default "Logo").
 * @returns Box del logo con coordinate e dimensioni opzionali.
 */
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
  const logo = findChildByName(comp, logoName);
  if (!comp || !logo) return {};
  const W = tpl.width;
  const H = tpl.height;
  const parseAnchor = (
    value: number | string | undefined,
    fallback: number
  ): number => {
    if (value == null) return fallback;
    const parsed = pctToPx(value as any, 100);
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      const ratio = parsed <= 1 ? parsed : parsed / 100;
      if (Number.isFinite(ratio)) {
        if (ratio <= 0) return 0;
        if (ratio >= 1) return 1;
        return ratio;
      }
    }
    return fallback;
  };

  const xAnchor = parseAnchor(logo.x_anchor as any, 0.5);
  const yAnchor = parseAnchor(logo.y_anchor as any, 0.5);

  const x = pctToPx(logo.x, W);
  const y = pctToPx(logo.y, H);
  const w = pctToPx(logo.width, W) || 0;
  const h = pctToPx(logo.height, H) || 0;

  const fallbackX = Number.isFinite(W) ? W * xAnchor : undefined;
  const fallbackY = Number.isFinite(H) ? H * yAnchor : undefined;

  const anchorX = typeof x === "number" ? x : fallbackX;
  const anchorY = typeof y === "number" ? y : fallbackY;

  let left =
    typeof anchorX === "number"
      ? anchorX - (w > 0 ? w * xAnchor : 0)
      : undefined;
  let top =
    typeof anchorY === "number"
      ? anchorY - (h > 0 ? h * yAnchor : 0)
      : undefined;

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

/**
 * Individua la famiglia di font usata da un elemento testo del template.
 *
 * @param tpl Documento Creatomate.
 * @param slideIndexOrName Indice o nome della slide/composition.
 * @param textName Nome dell'elemento testo (fallback automatico).
 * @returns Nome della famiglia tipografica oppure `undefined`.
 */
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

/**
 * Verifica se un flag rappresenta esplicitamente il valore `false`.
 *
 * @param value Input generico.
 * @returns `true` se rappresenta un falso esplicito.
 */
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

/**
 * Costruisce il blocco copyright partendo dal template e dalle eventuali
 * modifiche utente.
 *
 * @param template Documento Creatomate.
 * @param mods Modifiche ricevute dal backend.
 * @param compName Nome della composition.
 * @param elementName Nome dell'elemento copyright nel template.
 * @param videoW Larghezza del video.
 * @param videoH Altezza del video.
 * @returns Blocco testo pronto per il renderer oppure `undefined`.
 */
export function buildCopyrightBlock(
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

  const box = getTextBoxFromTemplate(template, compName, elementName, {
    preserveOrigin: true,
  });
  if (!box) return undefined;

  const templateWidth =
    typeof template.width === "number" && Number.isFinite(template.width) && template.width > 0
      ? template.width
      : videoW;
  const widthScale = computeWidthScaleFromTemplate(element, box.w, templateWidth);
  const layoutWidth =
    widthScale > 1 && box.w > 0 ? Math.round(box.w / widthScale) : box.w;
  const layoutBox =
    typeof layoutWidth === "number" && layoutWidth > 0 ? { ...box, w: layoutWidth } : box;

  const fontSizing = deriveFontSizing(
    element,
    MIN_FONT_SIZE,
    videoW,
    videoH,
    { scaleMultiplier: widthScale }
  );
  const initialFont = fontSizing.initial;
  const lineHeightFactor = parseLineHeightFactor((element as any)?.line_height) ?? 1.2;

  const manualBreaks = text.includes("\n");
  const wrapFontInitial = widthScale > 1 ? initialFont / widthScale : initialFont;
  const initialMax =
    typeof layoutBox.w === "number" && layoutBox.w > 0
      ? maxCharsForWidth(layoutBox.w, Math.round(wrapFontInitial))
      : DEFAULT_CHARS_PER_LINE;
  let lines = manualBreaks ? text.split(/\r?\n/) : wrapText(text, initialMax);
  lines = lines.map((ln) => ln.trim()).filter((ln) => ln);
  if (!lines.length) return undefined;

  const computeSpacing = (font: number, lineCount: number): number =>
    computeLineSpacingForBox(font, lineCount, box.h, lineHeightFactor);

  let fontSize = fontSizing.clamp(initialFont);
  let spacing = computeSpacing(fontSize, lines.length);
  if (!manualBreaks) {
    const layout = resolveTextLayout(text, layoutBox, fontSize, lineHeightFactor, {
      widthScale,
    });
    if (layout) {
      lines = [...layout.lines];
      fontSize = fontSizing.clamp(layout.font);
      spacing = computeSpacing(fontSize, lines.length);
    }
  }

  if (widthScale > 1) {
    const desiredFont = fontSizing.clamp(initialFont);
    if (desiredFont > fontSize) {
      const manual = fitTextWithTargetFont(
        text,
        typeof layoutBox.w === "number" ? layoutBox.w : box.w,
        { w: box.w, h: box.h },
        desiredFont,
        fontSize,
        widthScale,
        lineHeightFactor,
        undefined
      );
      if (manual) {
        lines = [...manual.lines];
        fontSize = fontSizing.clamp(manual.font);
        spacing = computeSpacing(fontSize, lines.length);
      }
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

  const alignSource =
    (element as any)?.x_alignment ??
    (element as any)?.text_align ??
    (element as any)?.text_alignment ??
    (element as any)?.horizontal_alignment ??
    (element as any)?.align ??
    (element as any)?.alignment;
  const alignX = parseAlignmentFactor(alignSource);
  if (alignX != null) {
    const letterSpacingPx = parseLetterSpacing(
      (element as any)?.letter_spacing,
      fontSize,
      videoW,
      videoH
    );
    applyHorizontalAlignment(block, lines, fontSize, letterSpacingPx, alignX, box, videoW);
  }

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
