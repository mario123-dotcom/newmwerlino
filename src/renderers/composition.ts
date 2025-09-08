import { runFFmpeg } from "../ffmpeg/run";
import { buildDrawText, toFFPath } from "../ffmpeg/filters";
import type { SlideSpec } from "../timeline";
import { getDefaultFontPath } from "../template";

/**
 * Renderizza UN segmento (slide) con:
 * - background cover+crop,
 * - logo non deformato (altezza fissa, AR preservato),
 * - testo posizionato,
 * - TTS in stereo (o silenzio se assente).
 */
export async function renderSlideSegment(slide: SlideSpec): Promise<void> {
  const W = slide.width ?? 1920;
  const H = slide.height ?? 1080;
  const dur = Number(slide.durationSec.toFixed(4));
  const fps = slide.fps;
  const out = slide.outPath;

  const logoH = slide.logoHeight ?? 140;
  const logoX = slide.logoX ?? 161;
  const logoY = slide.logoY ?? 713;

  const fontFile = slide.fontFile ?? getDefaultFontPath();

  // --- INPUTS
  const args: string[] = ["-y"];

  // base nera
  args.push("-f","lavfi","-t",`${dur}`,"-r",String(fps),"-i",`color=c=black:s=${W}x${H}`);

  let hasBG = false;
  if (slide.bgImagePath) {
    args.push("-i", slide.bgImagePath);
    hasBG = true;
  }

  let hasLogo = false;
  if (slide.logoPath) {
    args.push("-i", slide.logoPath);
    hasLogo = true;
  }

  let hasTTS = false;
  if (slide.ttsPath) {
    args.push("-i", slide.ttsPath);
    hasTTS = true;
  }

  // --- FILTER COMPLEX
  const f: string[] = [];
  f.push(`[0:v]format=rgba[base]`);

  // Background: cover + crop (usa "increase", non 'cover' che in scale è una stringa non valida)
  let lastV = "base";
  if (hasBG) {
    f.push(
      `[1:v]format=rgba,` +
      `scale=${W}:${H}:force_original_aspect_ratio=increase,` +
      `crop=${W}:${H},setsar=1[bg]`
    );
    f.push(`[${lastV}][bg]overlay=x=0:y=0:enable='between(t,0,${dur})'[v0]`);
    lastV = "v0";
  }

  // Logo (preserva AR, altezza fissa)
  if (hasLogo) {
    const logoIndex = hasBG ? 2 : 1;
    f.push(
      `[${logoIndex}:v]format=rgba,` +
      `scale=-1:${logoH}:flags=lanczos:force_original_aspect_ratio=decrease[lg]`
    );
    f.push(`[${lastV}][lg]overlay=x=${logoX}:y=${logoY}:enable='between(t,0,${dur})'[v1]`);
    lastV = "v1";
  }

  // Testi
  const fontFF = toFFPath(fontFile);
  if (slide.texts && slide.texts.length) {
    for (let i = 0; i < slide.texts.length; i++) {
      const tb = slide.texts[i];
      f.push(`[${lastV}]format=rgba[tx_${i}_in]`);

      const draw = buildDrawText({
        label: `tx_${i}`,
        textFile: tb.textFile ? toFFPath(tb.textFile) : undefined,
        text: tb.text,
        fontFile: fontFF,
        fontSize: tb.fontSize ?? 60,
        fontColor: tb.fontColor ?? "white",
        xExpr: String(tb.x),
        yExpr: String(tb.y),
        lineSpacing: tb.lineSpacing ?? 8,
        box: !!tb.box,
        boxColor: tb.boxColor ?? "black",
        boxAlpha: tb.boxAlpha ?? 0.0,
        boxBorderW: tb.boxBorderW ?? 0,
        enableExpr: `between(t,0,${dur})`,
      });

      // drawtext sovrascrive il frame d'ingresso, non servono blend separati
      f.push(draw); // -> [tx_i]
      lastV = `tx_${i}`;
    }
  }

  // --- AUDIO
  if (hasTTS) {
    // indice audio del TTS:
    // base + (bg?) + (logo?) -> poi tts
    const ttsAIndex = hasBG && hasLogo ? 3 : (hasBG || hasLogo ? 2 : 1);
    f.push(
      `[${ttsAIndex}:a]aformat=sample_rates=44100,` +
      `pan=stereo|c0=c0|c1=c0,` +
      `atrim=0:${dur},apad=pad_dur=${dur},` +
      `asetpts=PTS-STARTPTS[aout]`
    );
  } else {
    // traccia silenziosa stereo
    f.push(
      `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=0:${dur},asetpts=PTS-STARTPTS[aout]`
    );
  }

  const filterComplex = f.join(";");

  // --- MAP & CODECS
  args.push(
    "-filter_complex", filterComplex,
    "-map", `[${lastV}]`,
    "-map", "[aout]",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", "23",
    "-r", String(fps),
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    "-movflags", "+faststart",
    "-shortest",
    out
  );

  await runFFmpeg(args, `[Slide ${out}]`);
}
