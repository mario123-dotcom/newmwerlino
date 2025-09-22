import { existsSync, writeFileSync } from "fs";
import { runFFmpeg } from "./ffmpeg/run";

type ConcatArgs = {
  segments: string[];
  bgAudioPath?: string | null;
  outPath: string;
  concatTxtPath: string;
  fps: number;
  bgVolume?: number; // 0..1
};

// Rende il path sicuro per il demuxer concat: slash forward + apici singoli
function ffSafe(p: string): string {
  return p.replace(/\\/g, "/");
}

export async function concatAndFinalizeDemuxer(args: ConcatArgs) {
  const { segments, bgAudioPath, outPath, concatTxtPath, fps, bgVolume = 0.15 } = args;

  const hasBgAudio = !!(bgAudioPath && existsSync(bgAudioPath));

  // Scrivi concat.txt (una riga per file)
  const lines = segments.map((s) => `file '${ffSafe(s)}'`);
  writeFileSync(concatTxtPath, lines.join("\n"), "utf8");

  const ffargs: string[] = [
    "-y",
    "-fflags", "+genpts",
    "-f", "concat",
    "-safe", "0",
    "-i", concatTxtPath,
  ];

  if (hasBgAudio) {
    ffargs.push("-stream_loop", "-1", "-i", bgAudioPath!);
    ffargs.push(
      "-filter_complex",
      [
        "[0:a:0]aformat=channel_layouts=stereo:sample_rates=44100[tts]",
        `[1:a:0]aformat=channel_layouts=stereo:sample_rates=44100,volume=${bgVolume}[bg]`,
        "[tts][bg]amix=inputs=2:normalize=0:duration=longest:dropout_transition=0[mix]",
      ].join(";"),
      "-map", "0:v:0",
      "-map", "[mix]"
    );
  } else {
    ffargs.push("-map", "0:v:0", "-map", "0:a:0");
  }

  ffargs.push(
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", "18",
    "-r", String(fps),
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    "-movflags", "+faststart",
    "-shortest",
    outPath
  );

  await runFFmpeg(ffargs, "FFmpeg FINAL (demuxer concat)");
}
