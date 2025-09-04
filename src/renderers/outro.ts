import { existsSync } from "fs";
import { FOOTER, SCALES } from "../config";
import { runFFmpeg } from "../ffmpeg/run";
import { escDrawText } from "../utils/text";
import { ffmpegSafePath } from "../utils/ffmpeg";
import { deriveOrientation } from "../config";

/**
 * Crea il segmento finale (outro) con colore pieno, testo centrale e logo.
 *
 * @param seg     Durata e testo da visualizzare nell'outro.
 * @param outPath Percorso del video generato.
 * @param opts    Parametri video e risorse grafiche.
 */
export function renderOutroSegment(
  seg: { duration: number; text?: string },
  outPath: string,
  opts: {
    fps: number;
    videoW: number;
    videoH: number;
    fontPath: string;
    logoPath?: string | null;
    fillColor?: string;

  }
) {
  const { fps, videoW, videoH, fontPath, logoPath } = opts;
  const fillColor = opts.fillColor || "black";

  const text = seg.text || "";

  const args: string[] = [
    "-y",
    "-f",
    "lavfi",
    "-t",
    `${seg.duration}`,
    "-r",
    `${fps}`,
    "-i",
    `color=c=${fillColor}:s=${videoW}x${videoH}:r=${fps}`,
    "-f",
    "lavfi",
    "-t",
    `${seg.duration}`,
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
  ];

  const haveLogo = !!(logoPath && existsSync(logoPath));
  if (haveLogo) args.push("-i", logoPath!);

  // scala OUTRO in base all'orientamento
  const orientation = deriveOrientation(videoW, videoH);
  const outroScale = (SCALES as any)[orientation]?.OUTRO ?? 0.03;

  let fontSize = Math.round(videoH * outroScale);
  fontSize = Math.max(28, Math.min(84, fontSize));
  const lineH = Math.round(fontSize * 1.25);
  const OUTRO_GAP = 18;

  let fchain = `[0:v]format=rgba[base];`;
  const textCenterY = Math.round((videoH - lineH) / 2 + (lineH - 1));

  if (haveLogo) {
    const logoY = Math.round((videoH - FOOTER.LOGO_HEIGHT) / 2);
    const textY = logoY - OUTRO_GAP - 1;
    const safeFont = ffmpegSafePath(fontPath);
    fchain +=
      `[base]drawtext=fontfile='${safeFont}':fontsize=${fontSize}:fontcolor=white:` +
      `x=(w-text_w)/2:y=${textY}:text='${escDrawText(text)}'[pre]`;
    fchain += `;[2:v]scale=-1:${FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre][lg]overlay=x=(W-w)/2:y=${logoY}[v]`;
  } else {
    const safeFont = ffmpegSafePath(fontPath);
    fchain +=
      `[base]drawtext=fontfile='${safeFont}':fontsize=${fontSize}:fontcolor=white:` +
      `x=(w-text_w)/2:y=${textCenterY}:text='${escDrawText(text)}'[v]`;

  }

  args.push(
    "-filter_complex",
    fchain,
    "-map",
    "[v]",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-shortest",
    outPath
  );

  runFFmpeg(args, "FFmpeg SEG(outro)");
}

