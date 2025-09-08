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
  // Allow overriding the FFmpeg binary path via env var for environments where
  // the executable isn't globally available.
  ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
  concatList: join(process.cwd(), "src", "temp", "concat.txt"),
  finalVideo: join(process.cwd(), "src", "output", "final_output.mp4"),
  get bgAudio() { return join(this.audio, "bg.mp3"); },
};

