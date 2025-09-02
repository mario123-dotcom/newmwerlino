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
  /** forza un numero di righe identico per tutte le slide di un orientamento */
  fixedLines?: number;
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

/** ======= parametri di consistenza “globale” =======
 * Cambia QUI se vuoi 3 linee nei landscape e 4 nei portrait, ecc.
 */
const LINES_LANDSCAPE = 3;
const LINES_PORTRAIT  = 4;

/** split “pulito” in parole (spazi multipli normalizzati) */
function tokenize(text: string): string[] {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** distribuisce le parole in N righe con lunghezze (in caratteri) più bilanciate possibile */
function balancedLinesByCount(words: string[], fixedLines: number): string[] {
  if (fixedLines <= 1) return [words.join(" ")];

  const lens = words.map(w => w.length);
  const totalChars = lens.reduce((a, b) => a + b, 0) + Math.max(0, words.length - 1); // includi spazi
  const target = Math.ceil(totalChars / fixedLines);

  const lines: string[] = [];
  let acc: string[] = [];
  let accLen = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wlen = w.length + (acc.length ? 1 : 0); // + spazio se non primo nella riga
    // se aggiungo e supero il target "troppo", vado a capo prima
    if (acc.length && (accLen + wlen) > target * 1.15 && lines.length < fixedLines - 1) {
      lines.push(acc.join(" "));
      acc = [w];
      accLen = w.length;
    } else {
      acc.push(w);
      accLen += wlen;
    }
  }
  if (acc.length) lines.push(acc.join(" "));

  // Se ho meno righe del previsto (testo corto), “spalma” le righe creando righe vuote in coda? No: duplica le
  // ultime per mantenere N righe visivamente (opzionale). Di solito conviene lasciare meno righe piuttosto che righe vuote.
  // Qui invece garantiamo esattamente fixedLines “riempendo” spazi in modo uniforme.
  while (lines.length < fixedLines) lines.push("");

  // Se ho troppe righe per sbilanciamento, unisci le ultime
  while (lines.length > fixedLines) {
    const last = lines.pop()!;
    lines[lines.length - 1] = (lines[lines.length - 1] + " " + last).trim();
  }

  return lines;
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
  const { videoW, videoH, orientation, isFirstSlide, align, fixedLines, targetColsOverride } = opts;

  // 1) quante righe vogliamo?
  const linesWanted =
    fixedLines ??
    (orientation === "portrait" ? LINES_PORTRAIT : LINES_LANDSCAPE);

  // 2) righe bilanciate per conteggio caratteri
  const words = tokenize(text);
  const defaultCols = isFirstSlide
    ? WRAP_TARGET[orientation].FIRST
    : WRAP_TARGET[orientation].OTHER;
  const targetCols = targetColsOverride ?? defaultCols;

  let lines = balancedLinesByCount(words, linesWanted);
  // Se il testo è molto corto (tipo 1–2 parole), usa greedy per evitare molte righe vuote
  if (words.length <= 3) {
    lines = greedyWrapByCols(words, targetCols);
  }

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
    // ricalcola font per far stare linesWanted righe nello spazio
    fontSize = Math.floor(available / (lines.length * TEXT.LINE_HEIGHT));
    fontSize = Math.max(TEXT.MIN_SIZE, Math.min(TEXT.MAX_SIZE, fontSize));
    lineH = Math.max(1, Math.round(fontSize * TEXT.LINE_HEIGHT));
    blockH = lines.length * lineH;
  }

  // 5) y di partenza centrato nello spazio disponibile (clamp)
  const y0Centered = topMarginPx + Math.floor((available - blockH) / 2);
  const y0 = Math.max(topMarginPx, Math.min(bottomLimit - blockH, y0Centered));

  // 6) padding box + xExpr coerente
  const padPx = Math.max(4, Math.round(fontSize * TEXT.BOX_PAD_FACTOR));
  let xExpr = "(w-text_w)/2";
  const margin = Math.round(videoW * TEXT.LEFT_MARGIN_P);
  if (align === "left") {
    xExpr = `${margin}`;
  } else if (align === "right") {
    xExpr = `w-text_w-${margin}`;
  } else if (isFirstSlide && orientation === "landscape") {
    xExpr = `${margin}`;
  }

  return { lines, fontSize, lineH, y0, padPx, xExpr };
}
