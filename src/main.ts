#!/usr/bin/env ts-node
import { join } from "path";
import { DEFAULT_BG_VOL } from "./config";
import { paths } from "./paths";
import { loadTemplate, loadModifications } from "./template";
import { buildTimelineFromLayout, SlideSpec } from "./timeline";
import { renderSlideSegment } from "./renderers/composition";
import { concatAndFinalizeDemuxer } from "./concat";
import { fetchAssets } from "./fetchAssets";
import { sendFinalVideo } from "./share";

(async () => {
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
  const bg = paths.bgAudio; // ✅ usa la property esistente in paths
  await concatAndFinalizeDemuxer({
    segments: segFiles,
    bgAudioPath: bg,
    outPath: paths.finalVideo,   // ✅ prima era paths.final
    concatTxtPath: paths.concatList, // ✅ prima era paths.concat
    fps,
    bgVolume: DEFAULT_BG_VOL,
  });

  // 6) share
  await sendFinalVideo(paths.finalVideo); // ✅ prima era paths.final
})();
