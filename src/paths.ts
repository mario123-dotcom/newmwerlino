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
  finalVideo: join(root, "src", "output", "final_output.mp4"),
  pipelinePlan: join(root, "src", "output", "pipeline-plan.json"),
  get bgAudio() {
    return join(this.audio, "bg.mp3");
  },
};
