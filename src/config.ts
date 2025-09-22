/**
 * Raccolta di costanti condivise fra pipeline di timeline e renderer.
 * Le impostazioni regolano orientamento, tipografia, loghi, immagini e audio
 * in modo coerente per tutti i segmenti generati.
 */
export type Orientation = "landscape" | "portrait";
export type OrientationMode = "auto" | Orientation;

/**
 * Modalità scelta per l'orientamento del video finale.
 * "auto" lascia che l'orientamento venga dedotto dal template, mentre
 * "landscape" e "portrait" consentono di forzare un layout fisso.
 */
export const ORIENTATION_MODE: OrientationMode = "auto";

/**
 * Determina l'orientamento del progetto partendo da larghezza e altezza del
 * template. Se è stata definita una modalità esplicita, quella prevale.
 */
export function deriveOrientation(w: number, h: number): Orientation {
  if (ORIENTATION_MODE === "landscape" || ORIENTATION_MODE === "portrait") {
    return ORIENTATION_MODE;
  }
  return w >= h ? "landscape" : "portrait";
}

/**
 * Parametri utilizzati dal motore testuale per derivare dimensioni e layout.
 * I valori vengono letti dai builder della timeline come base quando il
 * template non fornisce indicazioni più precise.
 */
export const TEXT = {
  LINE_HEIGHT: 1.42,
  MIN_SIZE: 28,
  MAX_SIZE: 84,
  TOP_MARGIN_P: {
    landscape: 0.05,
    portrait: 0.08,
  },
  /** Margine aggiuntivo sul primo blocco per allineamenti manuali. */
  LEFT_MARGIN_P: 0.08,
  /** Rapporto medio larghezza/carattere usato per stimare gli ingombri. */
  CHAR_WIDTH_K: 0.55,
  /** Limite consigliato di caratteri per riga nelle slide principali. */
  MAX_CHARS_PER_LINE: 30,
  /** Fattore massimo di scala per i font ricavati dalle percentuali template. */
  MAX_FONT_SCALE: 1,
  /** Padding extra applicato agli sfondi di testo in base al font size. */
  BOX_PAD_FACTOR: 0.3,
  /** Larghezza minima del box testo rispetto alla larghezza del video. */
  MIN_BOX_WIDTH_RATIO: 0.65,
};

/**
 * Scala di grandezza predefinita per i titoli nelle varie tipologie di slide.
 * Il valore viene moltiplicato per l'altezza del video per ottenere un font
 * iniziale realistico.
 */
export const SCALES = {
  landscape: { FIRST: 0.2, OTHER: 0.15, OUTRO: 0.03 },
  portrait: { FIRST: 0.11, OTHER: 0.1, OUTRO: 0.028 },
};

/**
 * Target iniziali per la funzione di wrapping automatico del testo.
 * I builder possono discostarsi da questi valori in base alla larghezza del box.
 */
export const WRAP_TARGET = {
  landscape: { FIRST: 40, OTHER: 30 },
  portrait: { FIRST: 24, OTHER: 20 },
};

/** Ritmo dell'animazione "stagger" applicata nelle slide dinamiche. */
export const STAGGER = { base: 0.1, growth: 0.1, jitter: 0.015 };

/**
 * Parametri per il filtro "shade" utilizzato nel renderer per enfatizzare
 * il contrasto delle immagini di background.
 */
export const SHADE = {
  strength: 0.75,
  gamma: 1.0,
  leftPower: 0.5,
  vertPower: 0.6,
  bias: 0,
  enableOnFirstSlide: false,
};

/** Spaziature di riferimento per footer e logo aziendale. */
export const FOOTER = {
  LOGO_HEIGHT: 100,
  LINE_THICKNESS: 3,
  MARGIN_BOTTOM: 40,
  GAP: 12,
};

/** Volume di base per le clip TTS. */
export const DEFAULT_TTS_VOL = 0.9;
/** Livello di default della musica di sottofondo rispetto alla voce. */
export const DEFAULT_BG_VOL = 0.2;

/** Configurazione per il ducking applicato quando è presente audio parlato. */
export const DUCK = {
  threshold: 0.03,
  ratio: 20,
  attack: 5,
  release: 300,
  makeup: 1,
};

/** Durata extra in millisecondi mantenuta sulle slide alla fine del parlato. */
export const HOLD_EXTRA_MS = 250;
/** Curva di easing utilizzata nelle animazioni dei testi. */
export const EASE: "linear" | "cubicOut" | "quartOut" = "quartOut";
/** Impostazioni predefinite per la fase di concatenazione finale. */
export const CONCAT_DEFAULTS = {
  allowSkipBroken: true,
  tryAutoRepair: true,
} as const;
