import { runFFmpeg } from "../ffmpeg/run";
import { buildDrawText } from "../ffmpeg/filters";
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

  const logoW = slide.logoWidth ?? 240;
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

  const animateBackground = !!slide.backgroundAnimated;

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

  const targetAR = H > 0 ? W / H : 16 / 9;
  const arExpr = targetAR.toFixed(10);
  const cropWidthExpr = `min(iw,ih*${arExpr})`;
  const cropHeightExpr = `min(ih,iw/${arExpr})`;
  const cropFilter =
    `crop=w='${cropWidthExpr}':h='${cropHeightExpr}':x='(iw-ow)/2':y='(ih-oh)/2'`;

  // Background: cover + crop (usa "increase", non 'cover' che in scale è una stringa non valida)
  let lastV = "base";
  if (hasBG) {
    if (animateBackground && dur > 0) {
      const animFps = fps > 0 ? fps : 30;
      const frameCount = Math.max(1, Math.ceil(animFps * dur));
      const targetZoom = 1.06;
      const steps = Math.max(1, frameCount - 1);
      const zoomStep = (targetZoom - 1) / steps;
      const zoomExpr = `min(${targetZoom.toFixed(6)},1+${zoomStep.toFixed(7)}*on)`;
      const zoomScaleW = Math.max(W, Math.round(W * targetZoom));
      const zoomScaleH = Math.max(H, Math.round(zoomScaleW / targetAR));
      const centerXExpr = `max(0,(iw-iw/zoom)/2)`;
      const centerYExpr = `max(0,(ih-ih/zoom)/2)`;
      f.push(
        `[1:v]format=rgba,` +
          `${cropFilter},` +
          `scale=${zoomScaleW}:${zoomScaleH}:flags=lanczos,` +
          `zoompan=z='${zoomExpr}':d=${frameCount}:s=${W}x${H}:fps=${animFps.toFixed(6)}:x='${centerXExpr}':y='${centerYExpr}',` +
          `setsar=1[bg]`
      );
    } else {
      f.push(
        `[1:v]format=rgba,` +
          `${cropFilter},` +
          `scale=${W}:${H}:flags=lanczos,setsar=1[bg]`
      );
    }
    f.push(`[${lastV}][bg]overlay=x=0:y=0:enable='between(t,0,${dur})'[v0]`);
    lastV = "v0";
  }

  const wantsShadow =
    hasBG &&
    (slide.shadowEnabled ||
      slide.shadowColor != null ||
      slide.shadowAlpha != null ||
      slide.shadowW != null ||
      slide.shadowH != null);

  if (wantsShadow) {
    const sc =
      slide.shadowColor && slide.shadowColor.trim()
        ? slide.shadowColor
        : "black";
    const alphaRaw =
      typeof slide.shadowAlpha === "number" && Number.isFinite(slide.shadowAlpha)
        ? slide.shadowAlpha
        : undefined;
    const fallbackAlpha = 0.6;
    const sa = Math.min(Math.max(alphaRaw ?? fallbackAlpha, 0), 1);
    if (sa > 0) {
      const swRaw =
        typeof slide.shadowW === "number" && Number.isFinite(slide.shadowW)
          ? slide.shadowW
          : W;
      const shRaw =
        typeof slide.shadowH === "number" && Number.isFinite(slide.shadowH)
          ? slide.shadowH
          : H;
      const sw = Math.max(swRaw, W * 3);
      const sh = Math.max(shRaw, H * 3);
      const alphaBase = Number((255 * sa).toFixed(6));
      const xTerm = `max(${sw}-X,0)/${sw}`;
      const yTerm = `max(${sh}-(${H - 1}-Y),0)/${sh}`;
      const falloff = `pow(${xTerm},4)*pow(${yTerm},4)`;
      f.push(
        `color=c=${sc}@1:s=${W}x${H}:d=${dur},format=rgba,` +
          `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${alphaBase}*${falloff}'[shdw]`
      );
      f.push(
        `[${lastV}][shdw]overlay=x=0:y=0:enable='between(t,0,${dur})'[v_sh]`
      );
      lastV = "v_sh";
    }
  }

  if (slide.shapes && slide.shapes.length) {
    for (let i = 0; i < slide.shapes.length; i++) {
      const sh = slide.shapes[i];
      if (!(sh.width > 0) || !(sh.height > 0)) continue;
      const alpha = Math.min(Math.max(sh.alpha ?? 1, 0), 1);
      if (!(alpha > 0)) continue;

      const baseLabel = `shape_${i}_src`;
      f.push(
        `color=c=${sh.color}@${alpha}:s=${sh.width}x${sh.height}:d=${dur},format=rgba[${baseLabel}]`
      );
      let cur = baseLabel;

      const anims = sh.animations ?? [];
      const wipeAnims = anims.filter((a) => a.type === "wipe");
      let blankEnd = 0;
      if (wipeAnims.length) {
        blankEnd = Math.min(
          dur,
          Math.max(...wipeAnims.map((a) => (typeof a.time === "number" ? a.time : 0) + a.duration))
        );
        if (blankEnd > 0) {
          f.push(
            `color=c=black@0:s=${sh.width}x${sh.height}:d=${blankEnd},format=rgba[shape_${i}_blank]`
          );
        }
      }

      anims.forEach((an, ai) => {
        if ((an as any).reversed) return;
        if (an.type === "fade") {
          const st = typeof an.time === "number" ? an.time : Math.max(0, dur - an.duration);
          if (st + an.duration >= dur) return;
          const lbl = `shape_${i}_anim${ai}`;
          f.push(`[${cur}]fade=t=in:st=${st}:d=${an.duration}:alpha=1,format=rgba[${lbl}]`);
          cur = lbl;
        } else if (an.type === "wipe" && wipeAnims.length && blankEnd > 0) {
          if (an.time + an.duration >= dur) return;
          const tmp = `shape_${i}_tmp${ai}`;
          const lbl = `shape_${i}_anim${ai}`;
          f.push(
            `[shape_${i}_blank][${cur}]xfade=transition=${an.direction}:duration=${an.duration}:offset=${an.time},format=rgba[${tmp}]`
          );
          const pad = Math.max(0, dur - blankEnd);
          f.push(`[${tmp}]trim=0:${blankEnd},tpad=stop_mode=clone:stop_duration=${pad}[${lbl}]`);
          cur = lbl;
        }
      });

      const outLabel = `v_shape${i}`;
      f.push(
        `[${lastV}][${cur}]overlay=x=${sh.x}:y=${sh.y}:enable='between(t,0,${dur})'[${outLabel}]`
      );
      lastV = outLabel;
    }
  }

  // Logo (preserva AR dentro al box indicato)
  if (hasLogo) {
    const logoIndex = hasBG ? 2 : 1;
    f.push(
      `[${logoIndex}:v]format=rgba,` +
      `scale=${logoW}:${logoH}:flags=lanczos:force_original_aspect_ratio=decrease[lg]`
    );
    f.push(`[${lastV}][lg]overlay=x=${logoX}:y=${logoY}:enable='between(t,0,${dur})'[v1]`);
    lastV = "v1";
  }

  // Testi
  if (slide.texts && slide.texts.length) {
    for (let i = 0; i < slide.texts.length; i++) {
      const tb = slide.texts[i];

      if (
        tb.background &&
        !tb.box &&
        tb.background.width > 0 &&
        tb.background.height > 0 &&
        tb.background.alpha > 0
      ) {
        const bgLabel = `tx_${i}_bg`;
        f.push(
          `color=c=${tb.background.color}@${tb.background.alpha}:` +
            `s=${tb.background.width}x${tb.background.height}:d=${dur},format=rgba[${bgLabel}]`
        );
        const bgOut = `v_bg${i}`;
        f.push(
          `[${lastV}][${bgLabel}]overlay=` +
            `x=${tb.background.x}:y=${tb.background.y}:enable='between(t,0,${dur})'[${bgOut}]`
        );
        lastV = bgOut;
      }

      // layer trasparente su cui disegnare il testo; il "blank" serve solo per xfade
      const wipeAnims = tb.animations?.filter((a) => a.type === "wipe") ?? [];
      let blankEnd = 0;
      if (wipeAnims.length) {
        blankEnd = Math.min(
          dur,
          Math.max(...wipeAnims.map((a) => (a.time ?? 0) + a.duration))
        );
        f.push(`color=c=black@0:s=${W}x${H}:d=${blankEnd},format=rgba[tx_${i}_blank]`);
      }
      f.push(`color=c=black@0:s=${W}x${H}:d=${dur},format=rgba[tx_${i}_in]`);

      const blockFontFile = tb.fontFile ?? fontFile;
      const draw = buildDrawText({
        label: `tx_${i}`,
        textFile: tb.textFile,
        text: tb.text,
        fontFile: blockFontFile,
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

      f.push(draw); // -> [tx_i]

      let cur = `tx_${i}`;
      if (tb.animations && tb.animations.length) {
        tb.animations.forEach((an, ai) => {
          if ("reversed" in an && (an as any).reversed) return; // ignora animazioni "out"
          if (an.type === "fade") {
            const st = typeof an.time === "number" ? an.time : Math.max(0, dur - an.duration);
            // salta fade che finirebbero oltre la durata del segmento (fade-out)
            if (st + an.duration >= dur) return;
            const lbl = `tx_${i}_anim${ai}`;
            f.push(`[${cur}]fade=t=in:st=${st}:d=${an.duration}:alpha=1,format=rgba[${lbl}]`);
            cur = lbl;
          } else if (an.type === "wipe" && wipeAnims.length) {
            // salta wipe oltre la durata (evita wipe-out)
            if (an.time + an.duration >= dur) return;
            const tmp = `tx_${i}_tmp${ai}`;
            const lbl = `tx_${i}_anim${ai}`;
            f.push(
              `[tx_${i}_blank][${cur}]xfade=transition=${an.direction}:duration=${an.duration}:offset=${an.time},format=rgba[${tmp}]`
            );
            const pad = Math.max(0, dur - blankEnd);
            f.push(`[${tmp}]trim=0:${blankEnd},tpad=stop_mode=clone:stop_duration=${pad}[${lbl}]`);
            cur = lbl;
          }
        });
      }

      const outLbl = `v_txt${i}`;
      f.push(`[${lastV}][${cur}]overlay=x=0:y=0:enable='between(t,0,${dur})'[${outLbl}]`);
      lastV = outLbl;
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
