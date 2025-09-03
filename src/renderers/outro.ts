import { existsSync } from "fs";
import { FOOTER, SCALES } from "../config";
import { runFFmpeg } from "../ffmpeg/run";
import { escDrawText } from "../utils/text";
import { deriveOrientation } from "../config";

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
    logoPosition?: "bottom" | "top-left";
  }
) {
  const { fps, videoW, videoH, fontPath, logoPath } = opts;
  const fillColor = opts.fillColor || "black";
  const logoPosition = opts.logoPosition || "bottom";
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

  if (logoPosition === "bottom") {
    const groupH = lineH + OUTRO_GAP + FOOTER.LOGO_HEIGHT;
    const topY = Math.round((videoH - groupH) / 2);
    const textY = topY + (lineH - 1);
    const logoY = topY + lineH + OUTRO_GAP;
    fchain +=
      `[base]drawtext=fontfile='${fontPath}':fontsize=${fontSize}:fontcolor=white:` +
      `x=(w-text_w)/2:y=${textY}:text='${escDrawText(text)}'[pre]`;
    if (haveLogo)
      fchain += `;[2:v]scale=-1:${FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre][lg]overlay=x=(W-w)/2:y=${logoY}[v]`;
    else fchain += `;[pre]null[v]`;
  } else {
    const textY = Math.round((videoH - lineH) / 2 + (lineH - 1));
    fchain +=
      `[base]drawtext=fontfile='${fontPath}':fontsize=${fontSize}:fontcolor=white:` +
      `x=(w-text_w)/2:y=${textY}:text='${escDrawText(text)}'[pre]`;
    if (haveLogo)
      fchain += `;[2:v]scale=-1:${FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre][lg]overlay=x=${FOOTER.MARGIN_BOTTOM}:y=${FOOTER.MARGIN_BOTTOM}[v]`;
    else fchain += `;[pre]null[v]`;
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

