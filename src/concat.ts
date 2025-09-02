import { existsSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { ensureDir } from "./utils/fsx";
import { DUCK } from "./config";
import { runFFmpeg } from "./ffmpeg/run";
import { ffprobeJson } from "./validate";

export function concatAndFinalizeDemuxer({
  segments, bgAudioPath, outPath, concatTxtPath, fps, bgVolume
}: {
  segments: string[]; bgAudioPath?: string; outPath: string;
  concatTxtPath: string; fps: number; bgVolume: number;
}) {
  // Filelist
  const filelist = segments.map((p) => {
    const abs = resolve(p).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `file '${abs}'`;
  }).join("\n");

  ensureDir(dirname(concatTxtPath));
  writeFileSync(concatTxtPath, filelist, "utf8");

  const haveBg = !!(bgAudioPath && existsSync(bgAudioPath));
  const args: string[] = ["-y", "-fflags", "+genpts", "-f", "concat", "-safe", "0", "-i", concatTxtPath];
  if (haveBg) args.push("-stream_loop", "-1", "-i", bgAudioPath!);

  const probe = ffprobeJson(segments[0]);
  const haveAudio = probe?.streams?.some((s: any) => s.codec_type === "audio");
  const baseAudio = haveAudio
    ? `[0:a:0]aformat=channel_layouts=stereo:sample_rates=44100,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[acat]`
    : `anullsrc=channel_layout=stereo:sample_rate=44100,asetpts=PTS-STARTPTS[acat]`;
  const audioChain = haveBg
    ? [
        baseAudio,
        `[1:a:0]aformat=channel_layouts=stereo:sample_rates=44100,volume=${bgVolume}[bg]`,
        `[bg][acat]sidechaincompress=threshold=${DUCK.threshold}:ratio=${DUCK.ratio}:attack=${DUCK.attack}:release=${DUCK.release}:makeup=${DUCK.makeup}[bgduck]`,
        `[acat][bgduck]amix=inputs=2:normalize=0:duration=longest:dropout_transition=0[mix]`
      ].join(";")
    : `${baseAudio};[acat]anull[mix]`;

  args.push(
    "-filter_complex", audioChain,
    "-map", "0:v:0",
    "-map", "[mix]",
    "-c:v","libx264","-pix_fmt","yuv420p","-preset","medium","-crf","18","-r",String(fps),
    "-c:a","aac","-b:a","192k","-ar","44100","-ac","2",
    "-movflags","+faststart","-shortest", outPath
  );

  console.log("[DBG ] CONCAT (demuxer) filelist:\n" + filelist + "\n");
  console.log("[DBG ] FINAL filter_complex:\n" + audioChain + "\n");

  runFFmpeg(args, "FFmpeg FINAL (demuxer concat)");
}
