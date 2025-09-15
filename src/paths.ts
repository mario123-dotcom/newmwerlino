// ==============================
// FILE: src/paths.ts (ensure these constants exist)
// ==============================
import { join } from "path";

export const paths = {
  root: process.cwd(),
  temp: join(process.cwd(), "src", "temp"),
  output: join(process.cwd(), "src", "output"),
  images: join(process.cwd(), "download", "images"),
  tts: join(process.cwd(), "download", "tts"),
  audio: join(process.cwd(), "download", "audio"),
  fonts: join(process.cwd(), "download", "fonts"),
  templateDir: join(process.cwd(), "template"),
  template: join(process.cwd(), "template", "template_horizontal.json"),
  modifications: join(process.cwd(), "template", "risposta_horizontal.json"),
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

  concatList: join(process.cwd(), "src", "temp", "concat.txt"),
  finalVideo: join(process.cwd(), "src", "output", "final_output.mp4"),
  get bgAudio() { return join(this.audio, "bg.mp3"); },
};

