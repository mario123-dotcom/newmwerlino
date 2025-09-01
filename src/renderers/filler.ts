import { existsSync } from "fs";
import { FOOTER } from "../config";
import { runFFmpegAsync } from "../ffmpeg/run";

export function renderFillerSegment(
  seg: { duration: number },
  outPath: string,
  opts: { fps: number; videoW: number; videoH: number; logoPath?: string | null; }
): Promise<void> {
  const { fps, videoW, videoH, logoPath } = opts;
  const args: string[] = ["-y","-f","lavfi","-t",`${seg.duration}`,"-r",`${fps}`,"-i",`color=c=black:s=${videoW}x${videoH}:r=${fps}`,
                          "-f","lavfi","-t",`${seg.duration}`,"-i","anullsrc=channel_layout=stereo:sample_rate=44100"];
  const haveLogo = !!(logoPath && existsSync(logoPath));
  if (haveLogo) args.push("-i", logoPath!);

  const lineY = `ih-${FOOTER.MARGIN_BOTTOM + FOOTER.LOGO_HEIGHT + FOOTER.GAP}`;
  let fchain  = `[0:v]format=rgba[base];[base]drawbox=x=0:y=${lineY}:w=iw:h=${FOOTER.LINE_THICKNESS}:color=black@0.95:t=fill[pre1]`;
  if (haveLogo) fchain += `;[2:v]scale=-1:${FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre1][lg]overlay=x=(W-w)/2:y=(H-h)/2[v]`;
  else fchain += `;[pre1]null[v]`;

  args.push("-filter_complex", fchain, "-map", "[v]", "-map", "1:a:0",
            "-c:v","libx264","-pix_fmt","yuv420p","-preset","ultrafast",
            "-c:a","aac","-b:a","192k","-ar","44100","-ac","2","-shortest", outPath);

  return runFFmpegAsync(args, "FFmpeg SEG(filler)");
}
