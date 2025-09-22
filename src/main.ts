#!/usr/bin/env ts-node
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { DEFAULT_BG_VOL } from "./config";
import { paths } from "./paths";
import { loadTemplate, loadModifications } from "./template";
import { buildTimelineFromLayout, SlideSpec } from "./timeline";
import { renderSlideSegment, type SlideRenderPlan } from "./renderers/composition";
import { concatAndFinalizeDemuxer, type ConcatPlan } from "./concat";
import { fetchAssets } from "./fetchAssets";

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
  // Prepara le cartelle temporanee e svuota l'output precedente.
  ensureDir(paths.temp);
  ensureDir(paths.output);
  clearDir(paths.temp);
  clearDir(paths.output);

  // 1) Scarica gli asset remoti specificati dal backend.
  await fetchAssets();

  // 2) Carica layout Creatomate e personalizzazioni ricevute.
  const tpl = loadTemplate();
  const mods = loadModifications();
  const videoW = tpl.width || 1920;
  const videoH = tpl.height || 1080;
  const fps = tpl.frame_rate || 30;

  // 3) Genera la sequenza di SlideSpec a partire da template e dati.
  const slides: SlideSpec[] = buildTimelineFromLayout(mods, tpl, {
    videoW,
    videoH,
    fps,
    defaultDur: 7,
  });

  // 4) Calcola il piano di rendering per ogni segmento della timeline.
  const segFiles: string[] = [];
  const slidePlans: SlideRenderPlan[] = [];
  for (let i = 0; i < slides.length; i++) {
    const out = join(paths.temp, `seg-${i.toString().padStart(3, "0")}.mp4`);
    slides[i].outPath = out;
    console.log(
      `[render] texts=${slides[i].texts?.length ?? 0} tts=${!!slides[i].ttsPath} dur=${slides[i].durationSec}s`
    );
    const plan = await renderSlideSegment(slides[i]);
    slidePlans.push(plan);
    segFiles.push(out);
  }

  // 5) Produce il piano di concatenazione con l'eventuale musica di background.
  const bg = paths.bgAudio;
  const concatPlan: ConcatPlan = await concatAndFinalizeDemuxer({
    segments: segFiles,
    bgAudioPath: bg,
    outPath: paths.finalVideo,
    fps,
    bgVolume: DEFAULT_BG_VOL,
  });

  const pipelinePlan = {
    generatedAt: new Date().toISOString(),
    template: {
      width: videoW,
      height: videoH,
      fps,
    },
    slides: slidePlans,
    concat: concatPlan,
  };

  writeFileSync(paths.pipelinePlan, JSON.stringify(pipelinePlan, null, 2), "utf8");
  process.exit(0);
})();
