import { join } from "path";
import { ensureDir } from "./utils/fsx";

/**
 * Raccoglie i percorsi principali utilizzati dal progetto (asset scaricati,
 * cartelle temporanee e output). Le directory vengono create se mancanti.
 */
export const projectRoot = join(__dirname, "..");
export const downloadDir  = join(projectRoot, "download");

export const paths = {
  images: join(downloadDir, "images"),
  tts:    join(downloadDir, "tts"),
  audio:  join(downloadDir, "audio"),
  temp:   join(projectRoot, "src", "temp"),
  output: join(projectRoot, "src", "output"),
  fonts:  join(projectRoot, "fonts"),
  concat: join(projectRoot, "src", "temp", "concat.txt"),
  final:  join(projectRoot, "src", "output", "final_output.mp4"),
};

Object.values(paths).forEach((p) => {
  if (p.endsWith(".txt") || p.endsWith(".mp4")) return;
  ensureDir(p);
});
