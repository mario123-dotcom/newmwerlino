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

const LOCAL_FLAG_ALIASES = ["-local", "--local", "local"]; // direct matches
const LOCAL_FLAG_VALUE_MARKERS = ["mode", "asset-mode", "assets-mode", "assets", "asset", "source"];
const LOCAL_ENV_KEYS = [
  "LOCAL",
  "LOCAL_MODE",
  "LOCAL_ASSETS",
  "LOCAL_ASSET_MODE",
  "LOCAL_ASSET_SOURCE",
  "LOCAL_SOURCE",
  "USE_LOCAL",
  "USE_LOCAL_ASSETS",
  "USE_LOCAL_ASSET",
  "SKIP_ASSET_DOWNLOAD",
  "SKIP_ASSETS_DOWNLOAD",
  "SKIP_ASSET_FETCH",
  "NEWMERLINO_LOCAL",
  "NEWMERLINO_LOCAL_ASSETS",
  "NEWMERLINO_ASSET_MODE",
  "ASSET_MODE",
  "ASSETS_MODE",
  "ASSET_SOURCE",
  "ASSETS_SOURCE",
  "npm_config_local",
  "npm_config_local_mode",
  "npm_config_local_assets",
  "npm_config_local_asset_mode",
  "npm_config_use_local",
  "npm_config_use_local_assets",
  "npm_config_asset_mode",
  "npm_config_assets_mode",
  "npm_package_config_local",
  "npm_package_config_local_mode",
  "npm_package_config_use_local_assets",
];

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

function isTruthyEnvValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return ["1", "true", "yes", "y", "on", "abilitato", "enabled", "local"].includes(normalized);
}

function shouldUseLocalAssets(cliFlags: Set<string>): boolean {
  const normalizedFlags = new Set<string>();
  for (const flag of cliFlags) {
    normalizedFlags.add(flag.toLowerCase());
  }

  for (const alias of LOCAL_FLAG_ALIASES) {
    if (normalizedFlags.has(alias)) {
      return true;
    }
  }

  for (const flag of normalizedFlags) {
    if (flag.includes("=") || flag.includes(":")) {
      const separators = ["=", ":"];
      for (const sep of separators) {
        const idx = flag.indexOf(sep);
        if (idx !== -1) {
          const key = flag.slice(0, idx).replace(/^[-]+/, "");
          const value = flag.slice(idx + 1).trim();
          if (value.toLowerCase() === "local") {
            return true;
          }
          if (LOCAL_FLAG_VALUE_MARKERS.some((marker) => key.includes(marker))) {
            if (value.length === 0 || value.toLowerCase() === "true") {
              return true;
            }
          }
        }
      }
    }
  }

  const lifecycle = (process.env.npm_lifecycle_event || "").toLowerCase();
  if (["start:local", "start-local", "local"].includes(lifecycle)) {
    return true;
  }

  for (const key of LOCAL_ENV_KEYS) {
    const direct = process.env[key];
    if (isTruthyEnvValue(direct)) return true;

    const lower = process.env[key.toLowerCase()];
    if (isTruthyEnvValue(lower)) return true;

    const upper = process.env[key.toUpperCase()];
    if (isTruthyEnvValue(upper)) return true;
  }

  for (const [key, value] of Object.entries(process.env)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "npm_config_local_prefix") continue;
    if (lowerKey.includes("localhost")) continue;
    const matchesLocal =
      lowerKey.includes("use_local") ||
      lowerKey.includes("local_mode") ||
      lowerKey.includes("local-assets") ||
      lowerKey.includes("local_assets") ||
      lowerKey.endsWith("_local") ||
      lowerKey.startsWith("local_") ||
      /asset.*local|local.*asset/.test(lowerKey);
    if (matchesLocal && isTruthyEnvValue(value)) {
      return true;
    }
  }

  return false;
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
  const useLocalAssets = shouldUseLocalAssets(cliFlags);

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
