import { existsSync } from "fs";
import { FOOTER } from "../config";
import { runFFmpeg } from "../ffmpeg/run";

export function renderFillerSegment(
  seg: { duration: number },
  outPath: string,
  opts: { fps: number; videoW: number; videoH: number; logoPath?: string | null; fillColor?: string }
) {
  const { fps, videoW, videoH, logoPath } = opts;
  const fillColor = opts.fillColor || "black";
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

  let fchain = `[0:v]format=rgba[base]`;
  if (haveLogo)
    fchain += `;[2:v]scale=-1:${FOOTER.LOGO_HEIGHT},format=rgba[lg];[base][lg]overlay=x=(W-w)/2:y=(H-h)/2[v]`;
  else fchain += `;[base]null[v]`;

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

  runFFmpeg(args, "FFmpeg SEG(filler)");
}

