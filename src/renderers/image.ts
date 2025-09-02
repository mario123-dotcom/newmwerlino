import { existsSync } from "fs";
import { FOOTER, DEFAULT_TTS_VOL, SHADE } from "../config";
import { runFFmpeg } from "../ffmpeg/run";
import {
  shadeChain,
  buildFirstSlideTextChain,
  buildRevealTextChain_XFADE,
  zoomExprFullClip,
} from "../ffmpeg/filters";
import type { TextTransition } from "../types";

export function renderImageSeg(
  seg: { index?: number; duration: number; img?: string | null; tts?: string | null; text?: string; },
  outPath: string,
  opts: {
    fps: number;
    videoW: number;
    videoH: number;
    fontPath: string;
    logoPath?: string | null;

    textTransition?: TextTransition;

  }
) {
  if (!seg.img) throw new Error(`Image file missing for slide ${seg.index}`);

  const { fps, videoW, videoH, fontPath, logoPath } = opts;

  const isFirst = seg.index === 0;
  const textColor = isFirst ? "black" : "white";
  const shadeStrength = isFirst && !SHADE.enableOnFirstSlide ? 0 : SHADE.strength;
  const transition: TextTransition = (opts.textTransition ?? "wipeup").trim() as TextTransition;
  const align =
    transition === "wiperight" ? "left" :
    transition === "wipeleft" ? "right" :
    undefined;

  const revealChain = isFirst

    ? buildFirstSlideTextChain(
        seg.text || "",
        seg.duration,
        fontPath,
        videoW,
        videoH,
        fps,
        textColor,
        transition,
        align,
      )

    : buildRevealTextChain_XFADE(
        seg.text || "",
        seg.duration,
        fontPath,
        videoW,
        videoH,
        fps,
        textColor,
        transition,
        align,
      );

  const args: string[] = ["-y","-loop","1","-t",`${seg.duration}`,"-r",`${fps}`,"-i",seg.img];

  if (seg.tts && existsSync(seg.tts)) args.push("-i", seg.tts);
  else args.push("-f","lavfi","-t",`${seg.duration}`,"-i","anullsrc=channel_layout=stereo:sample_rate=44100");

  args.push("-f","lavfi","-t",`${seg.duration}`,"-r",`${fps}`,"-i",`color=c=black:s=${videoW}x${videoH}:r=${fps}`);

  const haveLogo = !!(logoPath && existsSync(logoPath));
  if (haveLogo) args.push("-i", logoPath!);

  const baseFit = `scale=${videoW}:${videoH}:force_original_aspect_ratio=increase:flags=bicubic+accurate_rnd+full_chroma_int,crop=${videoW}:${videoH}`;
  const zExpr = zoomExprFullClip(seg.duration, fps);
  const move  = `zoompan=z=${zExpr}:x=0:y=0:d=1:s=${videoW}x${videoH}:fps=${fps}`;

  let vHead = `[0:v]${baseFit},${move}[base];[2:v]${shadeChain(shadeStrength, SHADE.gamma)}[shade];[base][shade]overlay=x=0:y=0[pre0]`;
  const lineY = `ih-${FOOTER.MARGIN_BOTTOM + FOOTER.LOGO_HEIGHT + FOOTER.GAP}`;
  let footer  = `[pre0]drawbox=x=0:y=${lineY}:w=iw:h=${FOOTER.LINE_THICKNESS}:color=black@0.95:t=fill[pre1]`;
  if (haveLogo) footer += `;[3:v]scale=-1:${FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre1][lg]overlay=x=(W-w)/2:y=H-h-${FOOTER.MARGIN_BOTTOM}[pre]`;
  else footer += `;[pre1]null[pre]`;

  const vDrawChain = revealChain;
  const aChain =
    `[1:a]aformat=channel_layouts=stereo:sample_rates=44100,` +
    `aresample=async=1:first_pts=0,` +
    `apad,atrim=0:${seg.duration.toFixed(3)},asetpts=PTS-STARTPTS,` +
    `volume=${DEFAULT_TTS_VOL}[a]`;
  const fchain = `${vHead};${footer};${vDrawChain};${aChain}`;

  args.push("-filter_complex", fchain, "-map", "[v]", "-map", "[a]",
            "-c:v","libx264","-pix_fmt","yuv420p","-preset","ultrafast",
            "-c:a","aac","-b:a","192k","-ar","44100","-ac","2","-shortest", outPath);

  runFFmpeg(args, "FFmpeg SEG(image)");
}
