import { join } from "path";
import { TEXT } from "../../config";
import { paths } from "../../paths";
import { findChildByName, findComposition, type TemplateDoc, type TemplateElement } from "../../template";
import {
  buildCopyrightBlock,
  defaultTextBlock,
  getFontFamilyFromTemplate,
  getLogoBoxFromTemplate,
  getTextBoxFromTemplate,
} from "../templateHelpers";
import { deriveFontSizing, computeWidthScaleFromTemplate } from "../text";
import {
  extractShadow,
  extractShadowFromMods,
  findShadowSource,
  slideBackgroundNameCandidates,
} from "../shadows";
import { extractShapesFromComposition } from "../shapes";
import { findFontPath, findImageForSlide, findTTSForSlide } from "../assets";
import { parseSec } from "../utils";
import type { ShadowInfo, SlideSpec, TextBlockSpec } from "../types";
import { buildTextBlocks } from "./textBlocks";
import { MIN_FONT_SIZE } from "../constants";

type SlideBuildParams = {
  index: number;
  mods: Record<string, any>;
  template: TemplateDoc;
  templateWidth: number;
  videoW: number;
  videoH: number;
  fps: number;
  defaultDuration: number;
  globalShapeIndex: number;
  slideMaxChars?: number;
};

type SlideBuildResult = {
  slide?: SlideSpec;
  duration: number;
  shapesUsed: number;
};

/**
 * Valuta se un valore rappresenta un testo non vuoto.
 *
 * @param value Qualsiasi input proveniente dalle modifiche.
 * @returns `true` se contiene testo significativo.
 */
function isTruthyText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Calcola la durata effettiva della slide combinando le informazioni del
 * template, delle modifiche e dell'eventuale durata TTS.
 *
 * @param index Indice della slide.
 * @param comp Elemento composition del template relativo alla slide.
 * @param mods Modifiche provenienti dal backend.
 * @param defaultDuration Durata fallback se nessun dato è presente.
 * @returns Durata in secondi.
 */
function computeSlideDuration(
  index: number,
  comp: TemplateElement | undefined,
  mods: Record<string, any>,
  defaultDuration: number
): number {
  const base = parseSec(mods[`Slide_${index}.duration`], parseSec(comp?.duration, defaultDuration));
  const hinted = parseSec(mods[`TTS-${index}.duration`], 0);
  let duration = base;
  return hinted > duration ? hinted : duration;
}

/**
 * Prepara una lista di funzioni che provano a estrarre informazioni di shadow
 * da diverse fonti (template e modifiche).
 *
 * @param comp Composition della slide.
 * @param mods Modifiche utente.
 * @param index Indice numerico della slide.
 * @param videoW Larghezza del video in pixel.
 * @param videoH Altezza del video in pixel.
 * @returns Array di factory che producono {@link ShadowInfo} opzionali.
 */
function collectShadowSources(
  comp: TemplateElement | undefined,
  mods: Record<string, any>,
  index: number,
  videoW: number,
  videoH: number
): Array<() => ShadowInfo | undefined> {
  const candidates = slideBackgroundNameCandidates(index);
  return [
    () => extractShadow(comp, videoW, videoH),
    () => extractShadow(findShadowSource(comp, candidates), videoW, videoH),
    () => extractShadowFromMods(mods, `Slide_${index}`, videoW, videoH),
    ...candidates.map((name) => () => extractShadowFromMods(mods, name, videoW, videoH)),
  ];
}

/**
 * Aggiunge il blocco copyright alla lista dei testi se il template lo prevede.
 *
 * @param texts Blocchi di testo già generati.
 * @param template Documento Creatomate completo.
 * @param mods Modifiche del backend.
 * @param index Indice della slide.
 * @param videoW Larghezza del video.
 * @param videoH Altezza del video.
 * @returns Lista di blocchi aggiornata con eventuale copyright.
 */
function enrichTextsWithCopyright(
  texts: TextBlockSpec[],
  template: TemplateDoc,
  mods: Record<string, any>,
  index: number,
  videoW: number,
  videoH: number
): TextBlockSpec[] {
  const copyright = buildCopyrightBlock(
    template,
    mods,
    `Slide_${index}`,
    `Copyright-${index}`,
    videoW,
    videoH
  );
  if (!copyright) return texts;
  return [...texts, copyright];
}

/**
 * Genera la slide standard combinando testi, immagini, ombre, forme e audio.
 *
 * @param params Parametri raccolti (template, modifiche, dimensioni video, ecc.).
 * @returns Risultato contenente lo {@link SlideSpec} e metadati di durata.
 */
export function buildStandardSlide(params: SlideBuildParams): SlideBuildResult {
  const { index, mods, template, templateWidth, videoW, videoH, fps, defaultDuration, globalShapeIndex, slideMaxChars } = params;

  const comp = findComposition(template, `Slide_${index}`);
  const txtEl = findChildByName(comp, `Testo-${index}`) as TemplateElement | undefined;

  const duration = computeSlideDuration(index, comp, mods, defaultDuration);
  const textValue = isTruthyText(mods[`Testo-${index}`]) ? String(mods[`Testo-${index}`]).trim() : "";
  const ttsPath = findTTSForSlide(index);
  const textBox =
    getTextBoxFromTemplate(template, index, undefined, {
      preserveOrigin: true,
      minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
    }) || { x: 120, y: 160, w: 0, h: 0 };

  const baseBlock = defaultTextBlock(textBox.x, textBox.y);
  const widthScale = computeWidthScaleFromTemplate(txtEl, textBox.w, templateWidth);
  const layoutWidth =
    widthScale > 1 && textBox.w > 0 ? Math.round(textBox.w / widthScale) : textBox.w;
  const layoutBox =
    typeof layoutWidth === "number" && layoutWidth > 0 ? { ...textBox, w: layoutWidth } : textBox;

  const fontSizing = deriveFontSizing(
    txtEl,
    baseBlock.fontSize ?? MIN_FONT_SIZE,
    videoW,
    videoH,
    { scaleMultiplier: widthScale }
  );

  const textResult = textValue
    ? buildTextBlocks({
        text: textValue,
        fileIndex: index,
        textBox,
        layoutBox,
        baseBlock,
        fontSizing,
        widthScale,
        videoW,
        videoH,
        templateElement: txtEl,
        slideMaxChars,
      })
    : { base: baseBlock, lines: [], blocks: [] };

  const texts = enrichTextsWithCopyright(textResult.blocks, template, mods, index, videoW, videoH);
  const logoBox = getLogoBoxFromTemplate(template, index);
  const fontFamily = getFontFamilyFromTemplate(template, index);
  const fontPath = fontFamily ? findFontPath(fontFamily) : undefined;
  const bgImagePath = findImageForSlide(index);
  const shapes = extractShapesFromComposition(comp, mods, videoW, videoH, globalShapeIndex);
  const shadowSources = collectShadowSources(comp, mods, index, videoW, videoH);
  const hasShadow = shadowSources.some((factory) => !!factory());

  const slide: SlideSpec = {
    width: videoW,
    height: videoH,
    fps,
    durationSec: duration,
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
    shadowEnabled: hasShadow ? true : undefined,
  };

  const isFiller = !ttsPath && !textValue && texts.length === 0;
  if (isFiller) {
    const width = Math.max(slide.logoWidth ?? logoBox.w ?? 240, 1);
    const height = Math.max(slide.logoHeight ?? logoBox.h ?? 140, 1);
    slide.logoWidth = width;
    slide.logoHeight = height;
    slide.logoX = Math.round((videoW - width) / 2);
    slide.logoY = Math.round((videoH - height) / 2);
    slide.backgroundAnimated = false;
  } else if (bgImagePath && index > 0) {
    slide.backgroundAnimated = true;
  }

  if (process.env.DEBUG_TIMELINE) {
    const textFlag = textValue ? "✓" : "—";
    console.log(
      `[timeline] slide ${index} -> img=${!!slide.bgImagePath} tts=${!!slide.ttsPath} text=${textFlag} dur=${duration}s`
    );
  }

  return { slide, duration, shapesUsed: shapes.length };
}
