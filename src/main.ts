#!/usr/bin/env ts-node
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { DEFAULT_BG_VOL } from "./config";
import { paths } from "./paths";
import { loadTemplate, loadModifications } from "./template";
import { buildTimelineFromLayout, SlideSpec } from "./timeline";
import { renderSlideSegment } from "./renderers/composition";
import { concatAndFinalizeDemuxer } from "./concat";
import { fetchAssets, useLocalAssets } from "./fetchAssets";

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
  const args = process.argv.slice(2);

  function hasFlag(flag: string) {
    return args.includes(flag);
  }

  function fromEnvFlag(): boolean {
    const raw = process.env.npm_config_local ?? process.env.NPM_CONFIG_LOCAL;
    if (typeof raw !== "string") return false;
    const normalized = raw.trim().toLowerCase();
    return normalized !== "false" && normalized !== "0" && normalized !== "no";
  }

  function fromNpmArgv(): boolean {
    const raw = process.env.npm_config_argv;
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      const original: unknown = parsed?.original ?? parsed?.cooked;
      if (!Array.isArray(original)) return false;
      return original.includes("-local") || original.includes("--local");
    } catch (err) {
      console.warn("Impossibile leggere npm_config_argv:", err);
      return false;
    }
  }

  const localMode = hasFlag("-local") || hasFlag("--local") || fromEnvFlag() || fromNpmArgv();

  // prepara le cartelle di lavoro
  ensureDir(paths.temp);
  ensureDir(paths.output);
  clearDir(paths.temp);
  clearDir(paths.output);

  // 1) scarica asset
  if (localMode) {
    useLocalAssets();
  } else {
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
