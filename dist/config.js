"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONCAT_DEFAULTS = exports.EASE = exports.MIN_FILLER_SEC = exports.HOLD_EXTRA_MS = exports.DUCK = exports.DEFAULT_BG_VOL = exports.DEFAULT_TTS_VOL = exports.FOOTER = exports.SHADE = exports.STAGGER = exports.WRAP_TARGET = exports.SCALES = exports.TEXT = exports.ORIENTATION_MODE = void 0;
exports.deriveOrientation = deriveOrientation;
exports.ORIENTATION_MODE = "auto"; // "auto" | "landscape" | "portrait"
// Heuristics orientation dal template
function deriveOrientation(w, h) {
    if (exports.ORIENTATION_MODE === "landscape" || exports.ORIENTATION_MODE === "portrait") {
        return exports.ORIENTATION_MODE;
    }
    return w >= h ? "landscape" : "portrait";
}
/** Font + testo */
exports.TEXT = {
    LINE_HEIGHT: 1.42,
    MIN_SIZE: 28,
    MAX_SIZE: 84,
    TOP_MARGIN_P: {
        landscape: 0.12,
        portrait: 0.08,
    },
    /** margine sx per allineamento left (solo landscape slide 1) */
    LEFT_MARGIN_P: 0.08,
    /** rapporto medio larghezza/carattere in px ≈ k * fontsize */
    CHAR_WIDTH_K: 0.55, // 0.52–0.58 a seconda del font
    /** box padding (in multipli del font size) */
    BOX_PAD_FACTOR: 0.20,
};
/** Scale di base (fontsize ≈ scale * videoH) */
exports.SCALES = {
    landscape: { FIRST: 0.20, OTHER: 0.15, OUTRO: 0.03 },
    portrait: { FIRST: 0.11, OTHER: 0.10, OUTRO: 0.028 },
};
/** Target “wrapping” di partenza (caratteri) — verrà adattato in autosize */
exports.WRAP_TARGET = {
    landscape: { FIRST: 26, OTHER: 44 },
    portrait: { FIRST: 18, OTHER: 22 },
};
exports.STAGGER = { base: 0.10, growth: 0.10, jitter: 0.015 };
// Shade (immagini)
exports.SHADE = {
    strength: 0.9,
    gamma: 1.0,
    leftPower: 0.8,
    vertPower: 0.2,
    bias: 0.2,
    enableOnFirstSlide: false,
};
// Footer / Logo
exports.FOOTER = {
    LOGO_HEIGHT: 100,
    LINE_THICKNESS: 3,
    MARGIN_BOTTOM: 40,
    GAP: 12,
};
// Audio
exports.DEFAULT_TTS_VOL = 0.9;
exports.DEFAULT_BG_VOL = 0.04; // molto basso di base
exports.DUCK = {
    threshold: 0.03,
    ratio: 20,
    attack: 5,
    release: 300,
    makeup: 1, // FFmpeg richiede >=1
};
// Altro
exports.HOLD_EXTRA_MS = 250;
exports.MIN_FILLER_SEC = 0.08;
exports.EASE = "quartOut";
exports.CONCAT_DEFAULTS = {
    allowSkipBroken: true,
    tryAutoRepair: true,
};
