// src/ffmpeg/filters.ts
import { autosizeAndWrap, Orientation } from "../utils/autosize";
import { deriveOrientation, WRAP_TARGET, TEXT } from "../config";
import type { TextTransition } from "../types";

/** Ombra laterale: matte RGBA */
export function shadeChain(
  strength: number,
  gamma = 1.0,
  leftPower = 0.8,
  vertPower = 0.2,
  bias = 0.2,
  color = "black"
): string {
  if (strength <= 0) return "format=rgba,geq=r='0':g='0':b='0':a='0'";
  const shape  = `pow(1-(X/W),${leftPower})*pow(Y/H,${vertPower})`;
  const shaped = gamma === 1.0 ? shape : `pow(${shape},${gamma})`;
  const aExpr  = `255*${Math.max(0, Math.min(1, strength))}*clip(((${shaped})-${bias})/(1-${bias}),0\\,1)`;
  const rgb = (() => {
    const col = color.toLowerCase();
    if (col.startsWith("#") && (col.length === 7 || col.length === 4)) {
      const hex = col.slice(1);
      const r = hex.length === 3 ? parseInt(hex[0] + hex[0], 16) : parseInt(hex.slice(0, 2), 16);
      const g = hex.length === 3 ? parseInt(hex[1] + hex[1], 16) : parseInt(hex.slice(2, 4), 16);
      const b = hex.length === 3 ? parseInt(hex[2] + hex[2], 16) : parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
    switch (col) {
      case "red":
        return { r: 255, g: 0, b: 0 };
      case "black":
      default:
        return { r: 0, g: 0, b: 0 };
    }
  })();
  return `format=rgba,geq=r='${rgb.r}':g='${rgb.g}':b='${rgb.b}':a='${aExpr}'`;
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

  const chosenAlign = align ?? (orientation === "landscape" ? "left" : "center");

  const baseCols = WRAP_TARGET[orientation].FIRST;
  const targetOverride = transition === "wiperight"
    ? Math.max(1, Math.round(baseCols * 0.8))

    : undefined;

  const auto = autosizeAndWrap(txt, {
    orientation,
    isFirstSlide: true,
    videoW,
    videoH,
    align: chosenAlign,

    targetColsOverride: targetOverride,
  });

  if (!auto.lines.length || (auto.lines.length === 1 && auto.lines[0] === "")) return `[pre]null[v]`;

  const EXTRA  = Math.max(6, Math.round(videoH * 0.06));
  const CANV_H = auto.lineH + EXTRA;
  const blockH = auto.lines.length * auto.lineH;

  const parts: string[] = [];
  let inLbl = "pre";

  if (transition === "wiperight") {
    const margin = Math.round(videoW * TEXT.LEFT_MARGIN_P);
    const barW = Math.max(4, Math.round(auto.fontSize * 0.5));
    const barX = Math.max(0, margin - barW - auto.padPx);
    parts.push(`color=c=black:s=${barW}x${blockH}:r=${fps}:d=${segDur},format=rgba,setsar=1[bar_can]`);
    parts.push(`[bar_can]split=2[bar_rgb][bar_forA]`);
    parts.push(`[bar_forA]alphaextract,format=gray,setsar=1[bar_Aorig]`);
    parts.push(`color=c=black:s=${barW}x${blockH}:r=${fps}:d=${segDur},format=gray,setsar=1[bar_off]`);
    parts.push(`color=c=white:s=${barW}x${blockH}:r=${fps}:d=${segDur},format=gray,setsar=1[bar_on]`);
    parts.push(`[bar_off][bar_on]xfade=transition=wipeup:duration=0.6:offset=0[bar_wipe]`);
    parts.push(`[bar_Aorig][bar_wipe]blend=all_mode=multiply[bar_A]`);
    parts.push(`[bar_rgb][bar_A]alphamerge[bar_ready]`);
    parts.push(`[pre][bar_ready]overlay=x=${barX}:y=${auto.y0}[bar_out]`);
    inLbl = "bar_out";
  }

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
  const baseCols = WRAP_TARGET[orientation].OTHER;
  const targetOverride = transition === "wiperight"
    ? Math.max(1, Math.round(baseCols * 0.8))

    : undefined;

  const auto = autosizeAndWrap(txt, {
    orientation,
    isFirstSlide: false,
    videoW,
    videoH,
    align,

    targetColsOverride: targetOverride,
  });

  if (!auto.lines.length || (auto.lines.length === 1 && auto.lines[0] === "")) return `[pre]null[v]`;

  const parts: string[] = [];
  let inLbl = "pre";

  if (transition === "wiperight") {
    const margin = Math.round(videoW * TEXT.LEFT_MARGIN_P);
    const barW = Math.max(4, Math.round(auto.fontSize * 0.5));
    const blockH = auto.lines.length * auto.lineH;
    const barX = Math.max(0, margin - barW - auto.padPx);
    parts.push(`color=c=black:s=${barW}x${blockH}:r=${fps}:d=${segDur},format=rgba,setsar=1[bar_can]`);
    parts.push(`[bar_can]split=2[bar_rgb][bar_forA]`);
    parts.push(`[bar_forA]alphaextract,format=gray,setsar=1[bar_Aorig]`);
    parts.push(`color=c=black:s=${barW}x${blockH}:r=${fps}:d=${segDur},format=gray,setsar=1[bar_off]`);
    parts.push(`color=c=white:s=${barW}x${blockH}:r=${fps}:d=${segDur},format=gray,setsar=1[bar_on]`);
    parts.push(`[bar_off][bar_on]xfade=transition=wipeup:duration=0.6:offset=0[bar_wipe]`);
    parts.push(`[bar_Aorig][bar_wipe]blend=all_mode=multiply[bar_A]`);
    parts.push(`[bar_rgb][bar_A]alphamerge[bar_ready]`);
    parts.push(`[pre][bar_ready]overlay=x=${barX}:y=${auto.y0}[bar_out]`);
    inLbl = "bar_out";
  }

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
