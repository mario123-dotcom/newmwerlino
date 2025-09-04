#!/usr/bin/env ts-node

import { readdirSync, existsSync } from "fs";
import { join } from "path";

import { DEFAULT_BG_VOL } from "./config";
import { paths } from "./paths";
import { loadTemplate } from "./template";
import { loadSlideLayouts } from "./templateLayout";
import { buildTimeline } from "./timeline";
import { GetLocalAsset } from "./assets";
import { renderTemplateSlide } from "./renderers/templateObject";
import { renderFillerSegment } from "./renderers/filler";
import { renderOutroSegment } from "./renderers/outro";
import { validateAndRepairSegments } from "./validate";
import { concatAndFinalizeDemuxer } from "./concat";
import { REUSE_SEGS, SEGS_DIR, FILL_COLOR } from "./cli";
import { fetchAssets } from "./fetchAssets";
import { sendFinalVideo } from "./share";

(async () => {
  console.log("[LOG] Recupero asset dal template...");
  await fetchAssets(); // <<--- scarica tutti i file prima
  console.log("[LOG] Asset pronti, procedo al rendering.");

  console.log("[LOG] Reading JSON template...");
  const data = loadTemplate();
  const mods = data.modifications || {};
  const videoW = data.width || 1920;
  const videoH = data.height || 1080;
  const fps = data.frame_rate || 30;
  const layouts = loadSlideLayouts();

  // font
  const fontFiles = readdirSync(paths.fonts).filter((f) =>
    /\.(ttf|otf)$/i.test(f)
  );
  if (!fontFiles.length) {
    console.error("[ERROR] No fonts in fonts/");
    process.exit(1);
  }
  let fontPath = join(paths.fonts, fontFiles[0]).replace(/\\/g, "/");
  if (process.platform === "win32")
    fontPath = fontPath.replace(/^([A-Za-z]):\//, (_, d) => `${d}\\:/`);
  console.log("[LOG] Using font:", fontPath);

  // logo
  const logoPath = GetLocalAsset("logo") || "";

  // BG volume da JSON
  const bgVolFromJson = (() => {
    const v = String(mods["Audio.volume"] ?? "").trim();
    const m = v.match(/([\d.]+)\s*%/);
    if (m) return Math.max(0, Math.min(1, parseFloat(m[1]) / 100));
    return DEFAULT_BG_VOL;
  })();

  // timeline
  const timeline = buildTimeline(mods);
  console.log("[LOG] Timeline:");
  timeline.forEach((seg) => {
    const label = seg.kind === "image" ? `image #${seg.index}` : seg.kind;
    console.log(` • ${label} dur=${seg.duration.toFixed(3)}s`);
  });

  // render o riuso
  let segFiles: string[] = [];
  if (REUSE_SEGS) {
    const dir = SEGS_DIR || paths.temp;
    const found = readdirSync(dir)
      .filter((n) => /^seg\d+\.(mp4|mov|mkv)$/i.test(n))
      .sort(
        (a, b) =>
          parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10)
      )
      .map((n) => join(dir, n));
    if (!found.length) {
      console.error(
        `--reuse-segs attivo ma nessun segmento trovato in: ${dir}`
      );
      process.exit(1);
    }
    console.log(`♻️  Riutilizzo ${found.length} segmenti da ${dir}`);
    segFiles = found;
  } else {
    timeline.forEach((seg, idx) => {
      const out = join(paths.temp, `seg${idx}.mp4`);
      if (seg.kind === "image") {
        const layout = layouts[seg.index ?? 0] || [];
        const elements = layout.map((e) => {
          const el = { ...e };
          if (e.name === "Logo" && logoPath) el.file = logoPath;
          else if (e.name?.startsWith("Immagine") && seg.img) el.file = seg.img;
          else if (e.name?.startsWith("Testo")) el.text = seg.text || "";
          return el;
        }).filter((el) => el.type !== "image" || !!el.file);
        renderTemplateSlide(elements, seg.duration, out, {
          fps,
          videoW,
          videoH,
          fontPath,
        });
      }
      else if (seg.kind === "filler")
        renderFillerSegment(seg, out, {
          fps,
          videoW,
          videoH,
          logoPath,
          fillColor: FILL_COLOR,

        });
      else
        renderOutroSegment(seg, out, {
          fps,
          videoW,
          videoH,
          fontPath,
          logoPath,
          fillColor: FILL_COLOR,

        });
      segFiles.push(out);
      console.log(`[OK ] Segmento creato: ${out}`);
    });
  }

  // validazione/repair
  const goodSegs = validateAndRepairSegments(segFiles);

  // concat finale
  try {
    concatAndFinalizeDemuxer({
      segments: goodSegs,
      bgAudioPath: GetLocalAsset("audio") || undefined,
      outPath: paths.final,
      concatTxtPath: paths.concat,
      fps,
      bgVolume: bgVolFromJson,
    });
    console.log(`✅ Video finale creato in ${paths.final}`);
    try {
      await sendFinalVideo(paths.final);
    } catch (err) {
      console.error("[ERROR] Invio del video fallito:", err);
    }
  } catch (err) {
    console.error("[ERROR] Finalizzazione fallita:", err);
    console.error(
      "Verifica che i segmenti abbiano audio (anche silenzioso) e che il bg esista."
    );
  }
})();
