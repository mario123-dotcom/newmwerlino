import { STAGGER } from "../config";

export function djitter(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}
export function parseSec(v: any, def = 0): number {
  if (v == null) return def;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).trim();
  const m = s.match(/([\d.,]+)/);
  if (!m) return def;
  return parseFloat(m[1].replace(",", ".")) || def;
}
export function lineOffset(i: number, segDur: number, animDur: number) {
  const t = STAGGER.base * i + STAGGER.growth * (i * (i - 1)) / 2;
  const j = (djitter(i) * 2 - 1) * STAGGER.jitter;
  const off = Math.max(0, Math.min(segDur - animDur, t + j));
  return Number(off.toFixed(3));
}
