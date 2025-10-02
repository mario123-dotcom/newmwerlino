import { existsSync, mkdirSync } from "fs";
import { paths } from "./paths";

/**
 * Crea la directory indicata (e gli eventuali antenati) se non esiste già.
 *
 * @param dir Percorso assoluto della cartella da garantire.
 */
function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Garantisce la presenza delle cartelle degli asset senza effettuare download.
 *
 * Tutti gli asset vengono riutilizzati così come presenti nella cartella
 * `download`, rimuovendo la logica di pulizia e di fetch remoto.
 */
export async function fetchAssets() {
  ensureDir(paths.downloads);
  ensureDir(paths.audio);
  ensureDir(paths.images);
  ensureDir(paths.tts);
  ensureDir(paths.fonts);

  console.log("ℹ️ Utilizzo degli asset già presenti nella cartella download.");
}
