// src/ffmpeg/filters.ts
import { autosizeAndWrap, Orientation } from "../utils/autosize";
import { deriveOrientation } from "../config";
import type { TextTransition } from "../types";

/** Ombra laterale: matte RGBA */
export function shadeChain(
  strength: number,
  gamma = 1.0,
  leftPower = 0.8,
  vertPower = 0.2,
  bias = 0.2
): string {
  if (strength <= 0) return "format=rgba,geq=r='0':g='0':b='0':a='0'";
  const shape  = `pow(1-(X/W),${leftPower})*pow(Y/H,${vertPower})`;
  const shaped = gamma === 1.0 ? shape : `pow(${shape},${gamma})`;
  const aExpr  = `255*${Math.max(0, Math.min(1, strength))}*clip(((${shaped})-${bias})/(1-${bias}),0\\,1)`;
  return `format=rgba,geq=r='0':g='0':b='0':a='${aExpr}'`;
}

/** Zoom leggero (per zoompan) */
export function zoomExprFullClip(durationSec: number, fps: number): string {
  const frames = Math.max(1, Math.round(durationSec * fps));
  const zStart = 1.0, zEnd = 1.08;
  const step   = (zEnd - zStart) / Math.max(1, frames - 1);
  return `'min(${zStart.toFixed(3)}+on*${step.toFixed(6)},${zEnd.toFixed(3)})'`;
}

function escDrawText(s: string) {
  return String(s).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}
function djitter(i: number) { const x = Math.sin(i * 12.9898) * 43758.5453123; return x - Math.floor(x); }
function lineOffset(i: number, segDur: number, animDur: number) {
  const STAGGER = { base: 0.10, growth: 0.10, jitter: 0.015 };
  const t = STAGGER.base * i + (STAGGER.growth * (i * (i - 1))) / 2;
  const j = (djitter(i) * 2 - 1) * STAGGER.jitter;
  const off = Math.max(0, Math.min(segDur - animDur, t + j));
  return Number(off.toFixed(3));
}

/** FIRST — autosize + doppio box + wipe (righe coerenti) */
export function buildFirstSlideTextChain(
  txt: string,
  segDur: number,
  fontfile: string,
  videoW: number,
  videoH: number,
  fps: number,
  color = "black",
  transition: TextTransition = "wipeup",
  align?: "left" | "center" | "right",
): string {
  const orientation: Orientation = deriveOrientation(videoW, videoH);
  // Forziamo lo stesso numero di righe per orientamento
  const fixedLines = orientation === "portrait" ? 4 : 3;

  const chosenAlign = align ?? (orientation === "landscape" ? "left" : "center");

  const auto = autosizeAndWrap(txt, {
    orientation,
    isFirstSlide: true,
    videoW,
    videoH,
    align: chosenAlign,
    fixedLines,
  });

  if (!auto.lines.length || (auto.lines.length === 1 && auto.lines[0] === "")) return `[pre]null[v]`;

  const EXTRA  = Math.max(6, Math.round(videoH * 0.06));
  const CANV_H = auto.lineH + EXTRA;

  const parts: string[] = [];
  let inLbl = "pre";

  for (let i = 0; i < auto.lines.length; i++) {
    const safe   = escDrawText(auto.lines[i]);
    const offset = lineOffset(i, segDur, 0.6);
    const lineY  = auto.y0 + i * auto.lineH;

    parts.push(`color=c=black@0.0:s=${videoW}x${CANV_H}:r=${fps}:d=${segDur},format=rgba,setsar=1[S${i}_canvas]`);
    // box “doppio” per bordo pieno + anti-alias
    parts.push(`[S${i}_canvas]drawtext=fontfile='${fontfile}':fontsize=${auto.fontSize}:fontcolor=${color}@0:x=${auto.xExpr}:y=h-text_h-1+${EXTRA}:text='${safe}':box=1:boxcolor=white@1.0:boxborderw=${auto.padPx}[S${i}_big]`);
    parts.push(`[S${i}_big]drawtext=fontfile='${fontfile}':fontsize=${auto.fontSize}:fontcolor=${color}:x=${auto.xExpr}:y=h-text_h-1:text='${safe}':box=1:boxcolor=white@1.0:boxborderw=${auto.padPx}[S${i}_rgba]`);

    // alpha wipe con direzione configurabile
    parts.push(`[S${i}_rgba]split=2[S${i}_rgb][S${i}_forA]`);
    parts.push(`[S${i}_forA]alphaextract,format=gray,setsar=1[S${i}_Aorig]`);
    parts.push(`color=c=black:s=${videoW}x${CANV_H}:r=${fps}:d=${segDur},format=gray,setsar=1[S${i}_off]`);
    parts.push(`color=c=white:s=${videoW}x${CANV_H}:r=${fps}:d=${segDur},format=gray,setsar=1[S${i}_on]`);
    parts.push(`[S${i}_off][S${i}_on]xfade=transition=${transition}:duration=0.6:offset=${offset.toFixed(3)}[S${i}_wipe]`);
    parts.push(`[S${i}_Aorig][S${i}_wipe]blend=all_mode=multiply[S${i}_A]`);
    parts.push(`[S${i}_rgb][S${i}_A]alphamerge[S${i}_ready]`);

    // posizionamento riga con passo lineH calcolato → spaziatura identica
    parts.push(`[${inLbl}][S${i}_ready]overlay=x=0:y=${lineY}[S${i}_out]`);
    inLbl = `S${i}_out`;
  }

  parts.push(`[${inLbl}]null[v]`);
  return parts.join(";");
}

/** OTHER — autosize + XFADE centrato (righe coerenti) */
export function buildRevealTextChain_XFADE(
  txt: string,
  segDur: number,
  fontfile: string,
  videoW: number,
  videoH: number,
  fps: number,
  color = "white",
  transition: TextTransition = "wipeup",
  align: "left" | "center" | "right" = "center"
): string {
  const orientation: Orientation = deriveOrientation(videoW, videoH);
  const fixedLines = orientation === "portrait" ? 4 : 3;

  const auto = autosizeAndWrap(txt, {
    orientation,
    isFirstSlide: false,
    videoW,
    videoH,
    align,
    fixedLines,
  });

  if (!auto.lines.length || (auto.lines.length === 1 && auto.lines[0] === "")) return `[pre]null[v]`;

  const parts: string[] = [];
  let inLbl = "pre";

  for (let i = 0; i < auto.lines.length; i++) {
    const safe   = escDrawText(auto.lines[i]);
    const offset = lineOffset(i, segDur, 0.6);
    const lineY  = auto.y0 + i * auto.lineH;

    // canvas “a riga” di altezza esatta = lineH ⇒ spaziatura identica
    parts.push(`color=c=black@0.0:s=${videoW}x${auto.lineH}:r=${fps}:d=${segDur},format=rgba,setsar=1[L${i}_canvas]`);
    parts.push(`[L${i}_canvas]drawtext=fontfile='${fontfile}':fontsize=${auto.fontSize}:fontcolor=${color}:x=${auto.xExpr}:y=h-text_h-1:text='${safe}'[L${i}_rgba]`);

    // alpha XFADE (wipeup/wipedown/wipeleft/wiperight)
    parts.push(`[L${i}_rgba]split=2[L${i}_rgb][L${i}_forA]`);
    parts.push(`[L${i}_forA]alphaextract,format=gray,setsar=1[L${i}_Aorig]`);
    parts.push(`color=c=black:s=${videoW}x${auto.lineH}:r=${fps}:d=${segDur},format=gray,setsar=1[L${i}_off]`);
    parts.push(`color=c=white:s=${videoW}x${auto.lineH}:r=${fps}:d=${segDur},format=gray,setsar=1[L${i}_on]`);
    parts.push(`[L${i}_off][L${i}_on]xfade=transition=${transition}:duration=0.6:offset=${offset.toFixed(3)}[L${i}_wipe]`);
    parts.push(`[L${i}_Aorig][L${i}_wipe]blend=all_mode=multiply[L${i}_A]`);
    parts.push(`[L${i}_rgb][L${i}_A]alphamerge[L${i}_ready]`);

    parts.push(`[${inLbl}][L${i}_ready]overlay=x=0:y=${lineY}[L${i}_out]`);
    inLbl = `L${i}_out`;
  }

  parts.push(`[${inLbl}]null[v]`);
  return parts.join(";");
}
