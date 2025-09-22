import { join } from "path";

const root = process.cwd();
const downloads = join(root, "download");

function resolveFFmpegBinary(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    process.env.FFMPEG_BIN,
    process.env.FFMPEG,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "ffmpeg";
}

export const paths = {
  root,
  downloads,
  temp: join(root, "src", "temp"),
  output: join(root, "src", "output"),
  images: join(downloads, "images"),
  tts: join(downloads, "tts"),
  audio: join(downloads, "audio"),
  fonts: join(downloads, "fonts"),
  templateDir: join(root, "template"),
  template: join(root, "template", "template_horizontal.json"),
  modifications: join(root, "template", "risposta_horizontal.json"),
  ffmpeg: resolveFFmpegBinary(),
  concatList: join(root, "src", "temp", "concat.txt"),
  finalVideo: join(root, "src", "output", "final_output.mp4"),
  get bgAudio() {
    return join(this.audio, "bg.mp3");
  },
};
