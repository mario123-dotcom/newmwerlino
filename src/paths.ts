// ==============================
// FILE: src/paths.ts (ensure these constants exist)
// ==============================
import { join } from "path";

const root = process.cwd();
const downloads = join(root, "download");

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
  // Resolve the FFmpeg binary:
  // 1. Respect an explicit env override
  // 2. Use `ffmpeg-static` if it's installed
  // 3. Fall back to a plain `ffmpeg` lookup in PATH
  ffmpeg: (() => {
    if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
    try {
      // Optional dependency providing platform binaries
      return require("ffmpeg-static");
    } catch {
      return "ffmpeg";
    }
  })(),

  concatList: join(root, "src", "temp", "concat.txt"),
  finalVideo: join(root, "src", "output", "final_output.mp4"),
  get bgAudio() {
    return join(this.audio, "bg.mp3");
  },
};
