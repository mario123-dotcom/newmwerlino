import { join } from "path";

/**
 * Percorsi standardizzati utilizzati da tutta la toolchain. Tutti i path sono
 * assoluti e vengono ricavati dalla working directory del processo.
 */
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
  /**
   * Rilevazione dell'eseguibile FFmpeg, con supporto esclusivo a variabili
   * d'ambiente o, in assenza, al comando "ffmpeg" presente nella PATH.
   */
  ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",

  concatList: join(root, "src", "temp", "concat.txt"),
  finalVideo: join(root, "src", "output", "final_output.mp4"),
  get bgAudio() {
    return join(this.audio, "bg.mp3");
  },
};
