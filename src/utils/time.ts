import { STAGGER } from "../config";

/** Generatore deterministico di jitter pseudo-casuale basato sull'indice. */
export function djitter(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}
/**
 * Interpreta un valore come numero di secondi. Accetta numeri, stringhe con
 * virgole o punti e restituisce `def` in caso di parsing fallito.
 */
export function parseSec(v: any, def = 0): number {
  if (v == null) return def;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).trim();
  const m = s.match(/([\d.,]+)/);
  if (!m) return def;
  return parseFloat(m[1].replace(",", ".")) || def;
}

/**
 * Calcola uno sfasamento temporale crescente (con jitter) per animare
 * le linee di testo in sequenza.
 */
export function lineOffset(i: number, segDur: number, animDur: number) {
  const t = STAGGER.base * i + STAGGER.growth * (i * (i - 1)) / 2;
  const j = (djitter(i) * 2 - 1) * STAGGER.jitter;
  const off = Math.max(0, Math.min(segDur - animDur, t + j));
  return Number(off.toFixed(3));
}
