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

/**
 * Crea la cartella indicata se assente, includendo gli eventuali antenati.
 *
 * @param dir Percorso assoluto della directory da rendere disponibile.
 */
function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Svuota completamente una directory rimuovendo file e sottocartelle.
 *
 * @param dir Cartella di lavoro da ripulire; se non esiste viene ignorata.
 */
function clearDir(dir: string) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    rmSync(join(dir, f), { recursive: true, force: true });
  }
}

(async () => {
  /**
   * Pipeline principale:
   * 1. Prepara cartelle temporanee e output.
   * 2. Scarica asset remoti.
   * 3. Carica template e modifiche.
   * 4. Costruisce la timeline e renderizza ogni slide.
   * 5. Concatena i segmenti con eventuale musica di sottofondo.
   */
  // prepara le cartelle di lavoro
  ensureDir(paths.temp);
  ensureDir(paths.output);
  clearDir(paths.temp);
  clearDir(paths.output);

  // 1) scarica asset
  await fetchAssets();

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
  const bg = paths.bgAudio;
  await concatAndFinalizeDemuxer({
    segments: segFiles,
    bgAudioPath: bg,
    outPath: paths.finalVideo,
    concatTxtPath: paths.concatList,
    fps,
    bgVolume: DEFAULT_BG_VOL,
  });
  process.exit(0);
})();
