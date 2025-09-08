import { join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { paths } from "./paths";
import {
  TemplateDoc,
  findComposition,
  findChildByName,
  pctToPx,
} from "./template";

/* ---------- Tipi usati da composition.ts ---------- */
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

  // Posizionamento logo (px), altezza fissa se vuoi preservare AR
  logoHeight?: number;
  logoX?: number;
  logoY?: number;

  texts?: TextBlockSpec[];
};

/* ---------- Util ---------- */
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
 * Ricava la posizione di partenza (in pixel) del blocco di testo “Testo-i”
 * all'interno della composition "Slide_i" del template.
 *
 * Il template Creatomate descrive il testo tramite x/y, larghezza/altezza e
 * ancore x/y in percentuale.  Per ottenere il punto in alto a sinistra del
 * blocco testuale basta sottrarre al centro l'offset dato dalle ancore e
 * infine assicurarsi che il riquadro risultante resti dentro il canvas.
 */
export function getTextXYFromTemplate(
  tpl: TemplateDoc,
  slideIndex: number
): { x: number; y: number } | undefined {
  const comp = findComposition(tpl, `Slide_${slideIndex}`);
  const txtEl = findChildByName(comp, `Testo-${slideIndex}`);
  if (!comp || !txtEl) return undefined;

  const W = tpl.width,
    H = tpl.height;

  const x = pctToPx(txtEl.x, W);
  const y = pctToPx(txtEl.y, H);
  if (typeof x !== "number" || typeof y !== "number") return undefined;

  const w = pctToPx(txtEl.width, W) || 0;
  const h = pctToPx(txtEl.height, H) || 0;
  const xAnchor = (pctToPx(txtEl.x_anchor, 100) || 0) / 100; // 0..1
  const yAnchor = (pctToPx(txtEl.y_anchor, 100) || 0) / 100; // 0..1

  // Punto in alto a sinistra prima del clamp
  let left = x - w * xAnchor;
  let top = y - h * yAnchor;

  // Mantieni l'intero box dentro il canvas
  if (w > 0) left = Math.max(0, Math.min(W - w, left));
  else left = Math.max(0, Math.min(W - 10, left));
  if (h > 0) top = Math.max(0, Math.min(H - h, top));
  else top = Math.max(0, Math.min(H - 10, top));

  return { x: Math.round(left), y: Math.round(top) };
}

/** Ricava posizionamento del logo dalla composition “Slide_i” */
function getLogoXYHFromTemplate(tpl: TemplateDoc, slideIndex: number): { x?: number; y?: number; h?: number } {
  const comp = findComposition(tpl, `Slide_${slideIndex}`);
  const lg = findChildByName(comp, "Logo");
  if (!comp || !lg) return {};
  const W = tpl.width, H = tpl.height;
  const x = pctToPx(lg.x, W);
  const y = pctToPx(lg.y, H);
  const h = pctToPx(lg.height, H);
  return {
    x: typeof x === "number" ? Math.round(x) : undefined,
    y: typeof y === "number" ? Math.round(y) : undefined,
    h: typeof h === "number" ? Math.round(h) : undefined,
  };
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

  // Quante slide? guardo Testo-i / TTS-i / Immagine-i *presenti*
  let maxIdx = -1;
  for (let i = 0; i < 50; i++) {
    const hasTxt = typeof mods[`Testo-${i}`] === "string" && mods[`Testo-${i}`].trim() !== "";
    const hasTTS = !!mods[`TTS-${i}`] || !!findTTSForSlide(i);
    const hasImg = !!mods[`Immagine-${i}`] || !!findImageForSlide(i);
    if (hasTxt || hasTTS || hasImg) maxIdx = i;
  }
  const n = Math.max(0, maxIdx + 1);

  const slides: SlideSpec[] = [];

  for (let i = 0; i < n; i++) {
    const txtStr = typeof mods[`Testo-${i}`] === "string" ? mods[`Testo-${i}`].trim() : "";
    const textFiles = txtStr ? writeTextFilesForSlide(i, [txtStr]) : [];

    // posizioni dal template (se presenti)
    const txtPos = getTextXYFromTemplate(template, i) || { x: 120, y: 160 };
    const logoPos = getLogoXYHFromTemplate(template, i);

    const texts: TextBlockSpec[] = textFiles.length
      ? [{
          ...defaultTextBlock(),
          x: txtPos.x,
          y: txtPos.y,
          textFile: textFiles[0],
        }]
      : [];

    // Durata preferita: prima TTS-i.duration, poi Slide_i.duration, poi default
    const durPref =
      parseSec(mods[`TTS-${i}.duration`], NaN) ||
      parseSec(mods[`Slide_${i}.duration`], NaN) ||
      defaultDur;

    const slide: SlideSpec = {
      width: videoW,
      height: videoH,
      fps,
      durationSec: durPref,
      outPath: join(paths.temp, `seg-${String(i).padStart(3, "0")}.mp4`),

      bgImagePath: findImageForSlide(i),
      logoPath: join(paths.images, "logo.png"),
      ttsPath: findTTSForSlide(i),

      logoHeight: logoPos.h ?? 140,
      logoX: logoPos.x ?? 161,
      logoY: logoPos.y ?? 713,

      texts: texts.length ? texts : undefined,
    };

    console.log(
      `[timeline] slide ${i} -> img=${!!slide.bgImagePath} tts=${!!slide.ttsPath} text=${txtStr ? "✓" : "—"} dur=${durPref}s`
    );

    slides.push(slide);
  }

  return slides;
}
