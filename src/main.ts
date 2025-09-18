#!/usr/bin/env ts-node
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { DEFAULT_BG_VOL } from "./config";
import { paths } from "./paths";
import { loadTemplate, loadModifications } from "./template";
import { buildTimelineFromLayout, SlideSpec } from "./timeline";
import { renderSlideSegment } from "./renderers/composition";
import { concatAndFinalizeDemuxer } from "./concat";
import { fetchAssets } from "./fetchAssets";

function collectCliFlags(): Set<string> {
  const flags = new Set<string>();
  for (const arg of process.argv.slice(2)) {
    if (typeof arg === "string" && arg.length > 0) {
      flags.add(arg);
    }
  }

  const rawNpmArgs = process.env.npm_config_argv;
  if (rawNpmArgs) {
    try {
      const parsed = JSON.parse(rawNpmArgs) as Record<string, unknown>;
      const candidates = [parsed.original, parsed.cooked, parsed.remain];
      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          for (const value of candidate) {
            if (typeof value === "string" && value.startsWith("-")) {
              flags.add(value);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Impossibile analizzare gli argomenti di npm:", err);
    }
  }

  return flags;
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function clearDir(dir: string) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    rmSync(join(dir, f), { recursive: true, force: true });
  }
}

(async () => {
  // prepara le cartelle di lavoro
  ensureDir(paths.temp);
  ensureDir(paths.output);
  clearDir(paths.temp);
  clearDir(paths.output);

  const cliFlags = collectCliFlags();
  const useLocalAssets =
    cliFlags.has("-local") || cliFlags.has("--local") || cliFlags.has("local");

  if (useLocalAssets) {
    console.log(
      "▶️  Avvio in modalità locale: salto il download degli asset e uso quelli presenti in download/."
    );
  } else {
    // 1) scarica asset
    await fetchAssets();
  }

  // 2) carica template + modifications
  const tpl = loadTemplate();
  const mods = loadModifications();
  const videoW = tpl.width || 1920;
  const videoH = tpl.height || 1080;
  const fps = tpl.frame_rate || 30;

  // 3) costruisci slide
  const slides: SlideSpec[] = buildTimelineFromLayout(mods, tpl, {
    videoW,
    videoH,
    fps,
    defaultDur: 7,
  });

  // 4) renderizza ogni slide
  const segFiles: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const out = join(paths.temp, `seg-${i.toString().padStart(3, "0")}.mp4`);
    slides[i].outPath = out;
    console.log(
      `[render] texts=${slides[i].texts?.length ?? 0} tts=${!!slides[i].ttsPath} dur=${slides[i].durationSec}s`
    );
    await renderSlideSegment(slides[i]);
    segFiles.push(out);
  }

  // 5) concat & mix finale
  const bg = paths.bgAudio; // ✅ usa la property esistente in paths
  await concatAndFinalizeDemuxer({
    segments: segFiles,
    bgAudioPath: bg,
    outPath: paths.finalVideo,   // ✅ prima era paths.final
    concatTxtPath: paths.concatList, // ✅ prima era paths.concat
    fps,
    bgVolume: DEFAULT_BG_VOL,
  });
  process.exit(0);
})();
