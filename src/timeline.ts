import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { paths } from "./paths";
import {
  TemplateDoc,
  findComposition,
  findChildByName,
  pctToPx,
} from "./template";
import { probeDurationSec } from "./ffmpeg/probe";

/* ---------- Tipi usati da composition.ts ---------- */
export type AnimationSpec =
  | {
      type: "fade";
      time: number | "end";
      duration: number;
      reversed?: boolean;
    }
  | {
      type: "wipe";
      time: number;
      duration: number;
      direction: "wipeleft" | "wiperight" | "wipeup" | "wipedown";
    };

export type TextBlockSpec = {
  textFile?: string;
  text?: string;

  x: number;
  y: number;

  fontSize?: number;
  fontColor?: string;
  lineSpacing?: number;
  box?: boolean;
  boxColor?: string;
  boxAlpha?: number;
  boxBorderW?: number;

  animations?: AnimationSpec[];
};

export type SlideSpec = {
  width?: number;
  height?: number;
  fps: number;
  durationSec: number;
  outPath: string;

  bgImagePath?: string;
  logoPath?: string;
  ttsPath?: string;
  fontFile?: string;

  // Posizionamento e dimensione logo (px)
  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
  logoY?: number;

  texts?: TextBlockSpec[];

  // overlay shadow on background
  shadowColor?: string;
  shadowAlpha?: number;
  shadowW?: number;
  shadowH?: number;
};

/* ---------- Util ---------- */
const LINE_WIPE_DURATION = 0.5;
function ensureTempDir() {
  try { mkdirSync(paths.temp, { recursive: true }); } catch {}
}

function parseSec(v: any, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return fallback;
  const s = v.trim().toLowerCase().replace(",", ".");
  if (s.endsWith("ms")) {
    const n = parseFloat(s.replace("ms", ""));
    return Number.isFinite(n) ? n / 1000 : fallback;
  }
  if (s.endsWith("s")) {
    const n = parseFloat(s.replace("s", ""));
    return Number.isFinite(n) ? n : fallback;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

function lenToPx(v: any, W: number, H: number): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (s.endsWith("vmin")) {
    const n = parseFloat(s.replace("vmin", ""));
    return Number.isFinite(n) ? (n / 100) * Math.min(W, H) : undefined;
  }
  if (s.endsWith("px")) {
    const n = parseFloat(s.replace("px", ""));
    return Number.isFinite(n) ? n : undefined;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseRGBA(c: any): { color: string; alpha: number } | undefined {
  if (typeof c !== "string") return undefined;
  const m = c.trim().match(/^rgba?\((\d+),(\d+),(\d+)(?:,(\d*(?:\.\d+)?))?\)$/i);
  if (!m) return undefined;
  const r = Math.max(0, Math.min(255, parseInt(m[1], 10)));
  const g = Math.max(0, Math.min(255, parseInt(m[2], 10)));
  const b = Math.max(0, Math.min(255, parseInt(m[3], 10)));
  const a = m[4] != null ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return { color: `#${hex}`, alpha: a };
}

function writeTextFilesForSlide(i: number, lines: string[]): string[] {
  ensureTempDir();
  return lines.map((txt, idx) => {
    const p = join(paths.temp, `dtxt-${String(i).padStart(3, "0")}-${idx}.txt`);
    writeFileSync(p, String(txt ?? ""), "utf8");
    return p;
  });
}

/* --- asset locali già scaricati da fetchAssets() --- */
function findImageForSlide(i: number): string | undefined {
  const b = paths.images;
  const cand = [
    join(b, `img${i}.jpeg`),
    join(b, `img${i}.jpg`),
    join(b, `img${i}.png`),
  ];
  return cand.find(existsSync);
}
function findTTSForSlide(i: number): string | undefined {
  const b = paths.tts;
  const cand = [join(b, `tts-${i}.mp3`)];
  return cand.find(existsSync);
}

function findFontPath(family: string): string | undefined {
  const base = family.replace(/\s+/g, "").toLowerCase();
  try {
    for (const f of readdirSync(paths.fonts)) {
      if (f.toLowerCase().startsWith(base)) return join(paths.fonts, f);
    }
  } catch {}
  return undefined;
}

/* ---------- fallback testo se il template manca lo slot ---------- */
function defaultTextBlock(x = 120, y = 160): TextBlockSpec {
  return {
    x, y,
    fontSize: 60,
    fontColor: "white",
    lineSpacing: 8,
    box: false,
  };
}

/**
 * Ricava posizione e dimensioni del blocco di testo "Testo-i".
 * Restituisce coordinate del punto in alto a sinistra (clampate) e larghezza/
 * altezza in px.
 */
export function getTextBoxFromTemplate(
  tpl: TemplateDoc,
  slideIndexOrName: number | string,
  textName?: string
): { x: number; y: number; w: number; h: number } | undefined {
  const compName =
    typeof slideIndexOrName === "number"
      ? `Slide_${slideIndexOrName}`
      : slideIndexOrName;
  const txtName =
    textName ??
    (typeof slideIndexOrName === "number" ? `Testo-${slideIndexOrName}` : undefined);
  const comp = findComposition(tpl, compName);
  const txtEl = txtName ? findChildByName(comp, txtName) : undefined;
  if (!comp || !txtEl) return undefined;

  const W = tpl.width,
    H = tpl.height;

  const x = pctToPx(txtEl.x, W);
  const y = pctToPx(txtEl.y, H);
  if (typeof x !== "number" || typeof y !== "number") return undefined;

  const w = pctToPx(txtEl.width, W) || 0;
  const h = pctToPx(txtEl.height, H) || 0;
  const xAnchor = (pctToPx(txtEl.x_anchor, 100) || 0) / 100;
  const yAnchor = (pctToPx(txtEl.y_anchor, 100) || 0) / 100;

  let left = x - w * xAnchor;
  let top = y - h * yAnchor;

  if (w > 0) left = Math.max(0, Math.min(W - w, left));
  else left = Math.max(0, Math.min(W - 10, left));
  if (h > 0) top = Math.max(0, Math.min(H - h, top));
  else top = Math.max(0, Math.min(H - 10, top));

  return { x: Math.round(left), y: Math.round(top), w: Math.round(w), h: Math.round(h) };
}

/** Ricava posizione e dimensione del logo dalla composition "Slide_i" */
export function getLogoBoxFromTemplate(
  tpl: TemplateDoc,
  slideIndexOrName: number | string,
  logoName = "Logo"
): { x?: number; y?: number; w?: number; h?: number } {
  const compName =
    typeof slideIndexOrName === "number"
      ? `Slide_${slideIndexOrName}`
      : slideIndexOrName;
  const comp = findComposition(tpl, compName);
  const lg = findChildByName(comp, logoName);
  if (!comp || !lg) return {};
  const W = tpl.width,
    H = tpl.height;
  const x = pctToPx(lg.x, W);
  const y = pctToPx(lg.y, H);
  const w = pctToPx(lg.width, W) || 0;
  const h = pctToPx(lg.height, H) || 0;
  const xAnchor = (pctToPx(lg.x_anchor, 100) || 50) / 100;
  const yAnchor = (pctToPx(lg.y_anchor, 100) || 50) / 100;

  let left = typeof x === "number" ? x - w * xAnchor : undefined;
  let top = typeof y === "number" ? y - h * yAnchor : undefined;

  if (typeof left === "number") {
    left = Math.max(0, Math.min(W - w, left));
  }
  if (typeof top === "number") {
    top = Math.max(0, Math.min(H - h, top));
  }

  return {
    x: typeof left === "number" ? Math.round(left) : undefined,
    y: typeof top === "number" ? Math.round(top) : undefined,
    w: w > 0 ? Math.round(w) : undefined,
    h: h > 0 ? Math.round(h) : undefined,
  };
}

export function getFontFamilyFromTemplate(
  tpl: TemplateDoc,
  slideIndexOrName: number | string,
  textName?: string
): string | undefined {
  const compName =
    typeof slideIndexOrName === "number"
      ? `Slide_${slideIndexOrName}`
      : slideIndexOrName;
  const txtName =
    textName ??
    (typeof slideIndexOrName === "number" ? `Testo-${slideIndexOrName}` : undefined);
  const comp = findComposition(tpl, compName);
  const txtEl = txtName ? (findChildByName(comp, txtName) as any) : undefined;
  const fam = txtEl?.font_family;
  return typeof fam === "string" ? fam : undefined;
}

const DEFAULT_CHARS_PER_LINE = 40;

export function wrapText(text: string, maxPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxPerLine && line) {
      lines.push(line);
      line = w;
    } else if (candidate.length > maxPerLine) {
      lines.push(w);
      line = "";
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ============================================================
   COSTRUTTORE SLIDE
   - Legge contenuti da 'mods'
   - Prende posizioni (testo/logo) dal template
   ============================================================ */
export function buildTimelineFromLayout(
  modifications: Record<string, any>,
  template: TemplateDoc,
  opts: { videoW: number; videoH: number; fps: number; defaultDur?: number }
): SlideSpec[] {
  const { videoW, videoH, fps, defaultDur = 7 } = opts;
  const mods = modifications || {};

  // Numero di slide: oltre a testo/tts/immagini, consideriamo anche le
  // occorrenze `Slide_i.time` nelle modifications per includere eventuali
  // filler definiti solo nel template.
  let maxIdx = -1;
  const slideTimeRe = /^Slide_(\d+)\.time$/;
  for (const k of Object.keys(mods)) {
    const m = k.match(slideTimeRe);
    if (m) maxIdx = Math.max(maxIdx, Number(m[1]));
  }
  for (let i = 0; i < 50; i++) {
    const hasTxt = typeof mods[`Testo-${i}`] === "string" && mods[`Testo-${i}`].trim() !== "";
    const hasTTS = !!mods[`TTS-${i}`] || !!findTTSForSlide(i);
    const hasImg = !!mods[`Immagine-${i}`] || !!findImageForSlide(i);
    if (hasTxt || hasTTS || hasImg) maxIdx = Math.max(maxIdx, i);
  }
  const n = Math.max(0, maxIdx + 1);

  const slides: SlideSpec[] = [];
  let prevEnd = 0;

  for (let i = 0; i < n; i++) {
    const comp = findComposition(template, `Slide_${i}`);
    const txtEl = findChildByName(comp, `Testo-${i}`);
    const visMod = mods[`Slide_${i}.visible`];
    const isVisible =
      !(
        visMod === false ||
        visMod === 0 ||
        String(visMod).toLowerCase() === "false" ||
        comp?.visible === false
      );
    if (!isVisible) continue;

    const start = parseSec(mods[`Slide_${i}.time`], prevEnd);

    // Inserisci filler se c'è un gap rispetto alla fine precedente
    if (start > prevEnd + 0.001) {
      const gap = start - prevEnd;
      const fLogo = getLogoBoxFromTemplate(template, i) || {
        x: Math.round((videoW - 240) / 2),
        y: Math.round((videoH - 140) / 2),
        w: 240,
        h: 140,
      };
      slides.push({
        width: videoW,
        height: videoH,
        fps,
        durationSec: gap,
        outPath: "",
        logoPath: join(paths.images, "logo.png"),
        logoWidth: fLogo.w,
        logoHeight: fLogo.h,
        logoX: fLogo.x,
        logoY: fLogo.y,
      });
      prevEnd = start;
    }

    let slideDur = parseSec(
      mods[`Slide_${i}.duration`],
      parseSec(comp?.duration, defaultDur)
    );

    const ttsPath = findTTSForSlide(i);
    let ttsDur = parseSec(mods[`TTS-${i}.duration`], 0);
    if (!ttsDur && ttsPath) ttsDur = probeDurationSec(ttsPath);
    if (ttsDur > slideDur) slideDur = ttsDur;

    const txtStr = typeof mods[`Testo-${i}`] === "string" ? mods[`Testo-${i}`].trim() : "";

    const txtBox = getTextBoxFromTemplate(template, i) || { x: 120, y: 160, w: 0, h: 0 };
    const lines = txtStr
      ? wrapText(
          txtStr,
          txtBox.w > 0 ? Math.max(1, Math.floor(txtBox.w / (60 * 0.6))) : DEFAULT_CHARS_PER_LINE
        )
      : [];
    const textFiles = lines.length ? writeTextFilesForSlide(i, lines) : [];

    // Animazioni per ciascuna linea
    const baseBlock = defaultTextBlock(txtBox.x, txtBox.y);
    if (txtEl) {
      const bg = parseRGBA((txtEl as any).background_color);
      if (bg) {
        baseBlock.box = true;
        baseBlock.boxColor = bg.color;
        baseBlock.boxAlpha = bg.alpha;
      }
    }
    const lineHeight = (baseBlock.fontSize ?? 60) + (baseBlock.lineSpacing ?? 8);
    const perLineAnims: AnimationSpec[][] = textFiles.map(() => []);
    const anims = (txtEl as any)?.animations;
    if (Array.isArray(anims)) {
      for (const a of anims) {
        const dur = parseSec(a.duration, 0);
        if (
          a.type === "fade" &&
          dur > 0 &&
          a.reversed !== true &&
          String(a.time) !== "end"
        ) {
          const t = parseSec(a.time, 0);
          for (const arr of perLineAnims) {
            arr.push({ type: "fade", time: t, duration: dur });
          }
        }
      }
      const tr = anims.find(
        (a: any) => a.type === "text-reveal" && a.split === "line"
      );
      if (tr) {
        const dir =
          tr.axis === "y"
            ? (String(tr.y_anchor ?? "").trim() === "100%" ? "wipedown" : "wipeup")
            : (String(tr.x_anchor ?? "").trim() === "100%" ? "wipeleft" : "wiperight");
        for (let li = 0; li < perLineAnims.length; li++) {
          perLineAnims[li].push({
            type: "wipe",
            time: li * LINE_WIPE_DURATION,
            duration: LINE_WIPE_DURATION,
            direction: dir,
          });
        }
      }
    }

    const logoBox = getLogoBoxFromTemplate(template, i);
    const fontFamily = getFontFamilyFromTemplate(template, i);
    const fontPath = fontFamily ? findFontPath(fontFamily) : undefined;

    const compShadow = parseRGBA((comp as any)?.shadow_color);
    const compShadowW = lenToPx((comp as any)?.shadow_x, videoW, videoH);
    const compShadowH = lenToPx((comp as any)?.shadow_y, videoW, videoH);

    const texts: TextBlockSpec[] = textFiles.map((tf, idx) => ({
      ...baseBlock,
      y: baseBlock.y + idx * lineHeight,
      textFile: tf,
      animations: perLineAnims[idx].length ? perLineAnims[idx] : undefined,
    }));

    const slide: SlideSpec = {
      width: videoW,
      height: videoH,
      fps,
      durationSec: slideDur,
      outPath: "",

      bgImagePath: findImageForSlide(i),
      logoPath: join(paths.images, "logo.png"),
      ttsPath,

      fontFile: fontPath,

      logoWidth: logoBox.w ?? 240,
      logoHeight: logoBox.h ?? 140,
      logoX: logoBox.x ?? 161,
      logoY: logoBox.y ?? 713,

      texts: texts.length ? texts : undefined,

      shadowColor: compShadow?.color,
      shadowAlpha: compShadow?.alpha,
      shadowW: typeof compShadowW === "number" ? compShadowW : undefined,
      shadowH: typeof compShadowH === "number" ? compShadowH : undefined,
    };

    console.log(
      `[timeline] slide ${i} -> img=${!!slide.bgImagePath} tts=${!!slide.ttsPath} text=${txtStr ? "✓" : "—"} dur=${slideDur}s`
    );

    slides.push(slide);
    prevEnd = start + slideDur;
  }

  // Outro
  const outroComp = findComposition(template, "Outro");
  const outroVisMod = mods["Outro.visible"];
  const outroVisible =
    outroComp &&
    !(
      outroVisMod === false ||
      outroVisMod === 0 ||
      String(outroVisMod).toLowerCase() === "false" ||
      outroComp.visible === false
    );
  if (outroVisible) {
    const outroStart = parseSec(mods["Outro.time"], prevEnd);
    if (outroStart > prevEnd + 0.001) {
      const gap = outroStart - prevEnd;
      const fLogo = getLogoBoxFromTemplate(template, "Outro") || {
        x: Math.round((videoW - 240) / 2),
        y: Math.round((videoH - 140) / 2),
        w: 240,
        h: 140,
      };
      slides.push({
        width: videoW,
        height: videoH,
        fps,
        durationSec: gap,
        outPath: "",
        logoPath: join(paths.images, "logo.png"),
        logoWidth: fLogo.w,
        logoHeight: fLogo.h,
        logoX: fLogo.x,
        logoY: fLogo.y,
      });
      prevEnd = outroStart;
    }

    const outDur = parseSec(
      mods["Outro.duration"],
      parseSec(outroComp.duration, defaultDur)
    );
    const logoBox = getLogoBoxFromTemplate(template, "Outro");
    const textEl = findChildByName(outroComp, "Testo-outro") as any;
    const textBox = getTextBoxFromTemplate(template, "Outro", "Testo-outro");
    const fontFam = getFontFamilyFromTemplate(template, "Outro", "Testo-outro");
    const fontPath = fontFam ? findFontPath(fontFam) : undefined;
    const outShadow = parseRGBA((outroComp as any)?.shadow_color);
    const outShadowW = lenToPx((outroComp as any)?.shadow_x, videoW, videoH);
    const outShadowH = lenToPx((outroComp as any)?.shadow_y, videoW, videoH);
    const txt = textEl?.text as string | undefined;
    let texts: TextBlockSpec[] | undefined;
    if (txt && textBox) {
      const linesOut = wrapText(
        txt,
        textBox.w > 0 ? Math.max(1, Math.floor(textBox.w / (60 * 0.6))) : DEFAULT_CHARS_PER_LINE
      );
      const txtFiles = writeTextFilesForSlide(slides.length, linesOut);
      const baseOut = defaultTextBlock(textBox.x, textBox.y);
      const bg = parseRGBA(textEl?.background_color);
      if (bg) {
        baseOut.box = true;
        baseOut.boxColor = bg.color;
        baseOut.boxAlpha = bg.alpha;
      }
      const lineH = (baseOut.fontSize ?? 60) + (baseOut.lineSpacing ?? 8);
      const perLine: AnimationSpec[][] = txtFiles.map(() => []);
      const anims = textEl?.animations;
      if (Array.isArray(anims)) {
        for (const a of anims) {
          const dur = parseSec(a.duration, 0);
          if (
            a.type === "fade" &&
            dur > 0 &&
            a.reversed !== true &&
            String(a.time) !== "end"
          ) {
            const t = parseSec(a.time, 0);
            for (const arr of perLine) {
              arr.push({ type: "fade", time: t, duration: dur });
            }
          }
        }
        const tr = anims.find(
          (a: any) => a.type === "text-reveal" && a.split === "line"
        );
        if (tr) {
          const dir =
            tr.axis === "y"
              ? (String(tr.y_anchor ?? "").trim() === "100%" ? "wipedown" : "wipeup")
              : (String(tr.x_anchor ?? "").trim() === "100%" ? "wipeleft" : "wiperight");
          for (let li = 0; li < perLine.length; li++) {
            perLine[li].push({
              type: "wipe",
              time: li * LINE_WIPE_DURATION,
              duration: LINE_WIPE_DURATION,
              direction: dir,
            });
          }
        }
      }
      texts = txtFiles.map((tf, idx) => ({
        ...baseOut,
        y: baseOut.y + idx * lineH,
        textFile: tf,
        animations: perLine[idx].length ? perLine[idx] : undefined,
      }));
    }
    slides.push({
      width: videoW,
      height: videoH,
      fps,
      durationSec: outDur,
      outPath: "",
      logoPath: join(paths.images, "logo.png"),
      logoWidth: logoBox.w ?? 240,
      logoHeight: logoBox.h ?? 140,
      logoX: logoBox.x ?? Math.round((videoW - (logoBox.w ?? 240)) / 2),
      logoY: logoBox.y ?? Math.round((videoH - (logoBox.h ?? 140)) / 2),
      fontFile: fontPath,
      texts,
      shadowColor: outShadow?.color,
      shadowAlpha: outShadow?.alpha,
      shadowW: typeof outShadowW === "number" ? outShadowW : undefined,
      shadowH: typeof outShadowH === "number" ? outShadowH : undefined,
    });
  }

  return slides;
}
