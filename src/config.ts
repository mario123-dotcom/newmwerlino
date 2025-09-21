// src/core/config.ts
export type Orientation = "landscape" | "portrait";
export type OrientationMode = "auto" | Orientation;

export const ORIENTATION_MODE: OrientationMode = "auto"; // "auto" | "landscape" | "portrait"

/**
 * Determina l'orientamento (orizzontale/verticale) del video.
 * Se `ORIENTATION_MODE` è impostato manualmente, viene rispettato; altrimenti
 * l'orientamento viene dedotto confrontando larghezza e altezza del template.
 */
export function deriveOrientation(w: number, h: number): Orientation {
  if (ORIENTATION_MODE === "landscape" || ORIENTATION_MODE === "portrait") {
    return ORIENTATION_MODE;
  }
  return w >= h ? "landscape" : "portrait";
}

/** Font + testo */
export const TEXT = {
  LINE_HEIGHT: 1.42,
  MIN_SIZE: 28,
  MAX_SIZE: 84,
  TOP_MARGIN_P: {
    landscape: 0.05,
    portrait: 0.08,
  },
  /** margine sx per allineamento left (solo landscape slide 1) */
  LEFT_MARGIN_P: 0.08,
  /** rapporto medio larghezza/carattere in px ≈ k * fontsize */
  CHAR_WIDTH_K: 0.55, // 0.52–0.58 a seconda del font
  /** limite massimo indicativo di caratteri per riga sulle slide principali */
  MAX_CHARS_PER_LINE: 29,
  /** fattore massimo di scala per i font ricavati dal template quando il box si allarga */
  MAX_FONT_SCALE: 2,
  /** padding extra per gli sfondi del testo (in multipli del font size) */
  BOX_PAD_FACTOR: 0.30,
  /** larghezza minima del box testo (percentuale della larghezza video) */
  MIN_BOX_WIDTH_RATIO: 0.75,
};

/** Scale di base (fontsize ≈ scale * videoH) */
export const SCALES = {
  landscape: { FIRST: 0.20, OTHER: 0.15, OUTRO: 0.03 },
  portrait:  { FIRST: 0.11, OTHER: 0.10, OUTRO: 0.028 },
};

/** Target “wrapping” di partenza (caratteri) — verrà adattato in autosize */
export const WRAP_TARGET = {
  landscape: { FIRST: 40, OTHER: 30 },
  portrait:  { FIRST: 24, OTHER: 20 },
};

export const STAGGER = { base: 0.10, growth: 0.10, jitter: 0.015 };

// Shade (immagini)
export const SHADE = {
  strength: 0.9,
  gamma: 1.0,
  leftPower: 0.5,
  vertPower: 1.0,
  bias: 0,
  enableOnFirstSlide: false,
};

// Footer / Logo
export const FOOTER = {
  LOGO_HEIGHT: 100,
  LINE_THICKNESS: 3,
  MARGIN_BOTTOM: 40,
  GAP: 12,
};

// Audio
export const DEFAULT_TTS_VOL = 0.9;
// Volume predefinito dell'audio di background: abbastanza alto da essere
// percepito chiaramente, ma ancora sotto la voce TTS.
export const DEFAULT_BG_VOL  = 0.2;

export const DUCK = {
  threshold: 0.03,
  ratio: 20,
  attack: 5,
  release: 300,
  makeup: 1, // FFmpeg richiede >=1
};

// Altro
export const HOLD_EXTRA_MS = 250;
export const EASE: "linear" | "cubicOut" | "quartOut" = "quartOut";
export const CONCAT_DEFAULTS = {
  allowSkipBroken: true,
  tryAutoRepair: true,
} as const;