import { TEXT } from "../../config";
import { findComposition, type TemplateDoc } from "../../template";
import { parseSec } from "../utils";
import type { SlideSpec } from "../types";
import { buildStandardSlide } from "./standardSlide";
import { buildOutroSegment } from "./outroSlide";
import { createGapSlide } from "./gapSlide";
import { findImageForSlide, findTTSForSlide } from "../assets";

/**
 * Restituisce la larghezza del template garantendo un valore numerico valido.
 *
 * @param template Documento Creatomate caricato.
 * @param fallback Valore da usare se la larghezza nel template non è valida.
 * @returns Larghezza positiva in pixel.
 */
function resolveTemplateWidth(template: TemplateDoc, fallback: number): number {
  const { width } = template;
  return typeof width === "number" && Number.isFinite(width) && width > 0 ? width : fallback;
}

/**
 * Deriva il numero massimo di caratteri per riga partendo dalla configurazione.
 *
 * @returns Limite di caratteri o `undefined` se non impostato.
 */
function resolveSlideMaxChars(): number | undefined {
  const raw = TEXT.MAX_CHARS_PER_LINE;
  return typeof raw === "number" && raw > 0 ? raw : undefined;
}

/**
 * Interpreta flag eterogenei (boolean, stringa, numero) per stabilire se una
 * slide deve essere visibile.
 *
 * @param value Valore letto dalle modifiche.
 * @returns `true` se la slide è attiva, `false` in caso di disattivazione esplicita.
 */
function isVisibleFlag(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return !(normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off");
  }
  return true;
}

/**
 * Analizza le modifiche alla ricerca dell'ultimo indice di slide da costruire.
 *
 * @param mods Oggetto con le chiavi provenienti dal backend.
 * @returns L'indice massimo individuato o -1 se nessuna slide è presente.
 */
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

/**
 * Costruisce la sequenza di slide partendo dal template e dal payload di
 * modifiche, generando eventuali gap e slide finali.
 *
 * @param modifications Dati provenienti dal backend (testi, immagini, tempi).
 * @param template Documento Creatomate originale.
 * @param opts Dimensioni video, FPS e durata di default.
 * @returns Array ordinato di {@link SlideSpec} pronti per il rendering.
 */
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
