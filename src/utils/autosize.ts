// src/utils/autosize.ts
import { FOOTER, SCALES, TEXT, WRAP_TARGET, deriveOrientation } from "../config";

export type Orientation = "landscape" | "portrait";

type AutoOpts = {
  orientation: Orientation;
  isFirstSlide: boolean;
  videoW: number;
  videoH: number;
  /** allineamento orizzontale del blocco di testo */
  align?: "left" | "center" | "right";
  /** sovrascrive il target di caratteri per riga; se assente si usa WRAP_TARGET */
  targetColsOverride?: number;
};

export type AutoSizeResult = {
  lines: string[];
  fontSize: number;
  lineH: number;
  y0: number;
  padPx: number;
  xExpr: string; // drawtext x
};

/** split “pulito” in parole (spazi multipli normalizzati) */
function tokenize(text: string): string[] {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}


/** wrap “greedy” su target colonne */
function greedyWrapByCols(words: string[], cols: number): string[] {
  const lines: string[] = [];
  let line: string[] = [];
  let len = 0;
  for (const w of words) {
    const add = w.length + (line.length ? 1 : 0);
    if (line.length && (len + add) > cols) {
      lines.push(line.join(" "));
      line = [w];
      len = w.length;
    } else {
      line.push(w);
      len += add;
    }
  }
  if (line.length) lines.push(line.join(" "));
  return lines;
}

/** calcola fontSize/lineH/y0/xExpr coerenti e restituisce righe “bilanciate” */
export function autosizeAndWrap(text: string, opts: AutoOpts): AutoSizeResult {
  const { videoW, videoH, orientation, isFirstSlide, align, targetColsOverride } = opts;

  // 1) tokenizza e wrap greedy sui target di caratteri
  const words = tokenize(text);
  const defaultCols = isFirstSlide
    ? WRAP_TARGET[orientation].FIRST
    : WRAP_TARGET[orientation].OTHER;
  const targetCols = targetColsOverride ?? defaultCols;

  const lines = greedyWrapByCols(words, targetCols);


  // 3) area verticale disponibile
  const topMarginPx = Math.round(videoH * TEXT.TOP_MARGIN_P[orientation]);
  const bottomLimit = videoH - (FOOTER.MARGIN_BOTTOM + FOOTER.LOGO_HEIGHT + FOOTER.GAP) - 16;
  const available = Math.max(40, bottomLimit - topMarginPx);

  // 4) fontSize base → clamp → ricava lineH e forza a stare tutto in altezza disponibile
  const baseScale = isFirstSlide ? SCALES[orientation].FIRST : SCALES[orientation].OTHER;
  let fontSize = Math.round(videoH * baseScale);
  fontSize = Math.max(TEXT.MIN_SIZE, Math.min(TEXT.MAX_SIZE, fontSize));

  let lineH = Math.max(1, Math.round(fontSize * TEXT.LINE_HEIGHT));
  let blockH = lines.length * lineH;

  if (blockH > available) {
    // ricalcola font per far stare tutte le righe nello spazio
    fontSize = Math.floor(available / (lines.length * TEXT.LINE_HEIGHT));
    fontSize = Math.max(TEXT.MIN_SIZE, Math.min(TEXT.MAX_SIZE, fontSize));
    lineH = Math.max(1, Math.round(fontSize * TEXT.LINE_HEIGHT));
    blockH = lines.length * lineH;
  }

  // 5) verifica larghezza massima e ridimensiona se necessario
  const margin = Math.round(videoW * TEXT.LEFT_MARGIN_P);
  const maxWidth = videoW - margin * 2;
  let padPx = Math.max(4, Math.round(fontSize * TEXT.BOX_PAD_FACTOR));
  let maxLineW =
    Math.max(0, ...lines.map((l) => l.length)) * fontSize * TEXT.CHAR_WIDTH_K + padPx * 2;
  if (maxLineW > maxWidth) {
    const scale = maxWidth / maxLineW;
    fontSize = Math.max(TEXT.MIN_SIZE, Math.floor(fontSize * scale));
    lineH = Math.max(1, Math.round(fontSize * TEXT.LINE_HEIGHT));
    padPx = Math.max(4, Math.round(fontSize * TEXT.BOX_PAD_FACTOR));
    blockH = lines.length * lineH;
    if (blockH > available) {
      fontSize = Math.floor(available / (lines.length * TEXT.LINE_HEIGHT));
      fontSize = Math.max(TEXT.MIN_SIZE, Math.min(TEXT.MAX_SIZE, fontSize));
      lineH = Math.max(1, Math.round(fontSize * TEXT.LINE_HEIGHT));
      padPx = Math.max(4, Math.round(fontSize * TEXT.BOX_PAD_FACTOR));
      blockH = lines.length * lineH;
    }
  }

  // 6) y di partenza centrato nello spazio disponibile (clamp)
  const y0Centered = topMarginPx + Math.floor((available - blockH) / 2);
  const y0 = Math.max(topMarginPx, Math.min(bottomLimit - blockH, y0Centered));

  // 7) xExpr coerente
  let xExpr = "(w-text_w)/2";
  if (align === "left") {
    xExpr = `${margin}`;
  } else if (align === "right") {
    xExpr = `w-text_w-${margin}`;
  } else if (isFirstSlide && orientation === "landscape") {
    xExpr = `${margin}`;
  }

  return { lines, fontSize, lineH, y0, padPx, xExpr };
}
