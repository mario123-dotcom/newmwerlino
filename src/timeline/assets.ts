import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { paths } from "../paths";
import { fileNameMatchesFamily } from "../fonts";

/**
 * Garantisce l'esistenza della cartella temporanea per i file drawtext.
 */
export function ensureTempDir(): void {
  try {
    mkdirSync(paths.temp, { recursive: true });
  } catch {}
}

/**
 * Scrive su disco le righe di testo destinate alla slide corrente generando
 * file temporanei compatibili con `drawtext`.
 *
 * @param index Indice della slide utilizzato per nominare i file.
 * @param lines Array di righe da scrivere su file.
 * @returns Percorsi completi dei file creati.
 */
export function writeTextFilesForSlide(index: number, lines: string[]): string[] {
  ensureTempDir();
  return lines.map((text, lineIndex) => {
    const filePath = join(paths.temp, `dtxt-${String(index).padStart(3, "0")}-${lineIndex}.txt`);
    writeFileSync(filePath, String(text ?? ""), "utf8");
    return filePath;
  });
}

/**
 * Individua l'immagine associata alla slide cercando le estensioni supportate.
 *
 * @param index Numero progressivo della slide.
 * @returns Percorso del file immagine oppure `undefined` se assente.
 */
export function findImageForSlide(index: number): string | undefined {
  const base = paths.images;
  const candidates = [
    join(base, `img${index}.jpeg`),
    join(base, `img${index}.jpg`),
    join(base, `img${index}.png`),
  ];
  return candidates.find(existsSync);
}

/**
 * Restituisce la clip TTS salvata per la slide indicata.
 *
 * @param index Numero progressivo della slide.
 * @returns Percorso del file audio oppure `undefined` se non trovato.
 */
export function findTTSForSlide(index: number): string | undefined {
  const base = paths.tts;
  const candidates = [join(base, `tts-${index}.mp3`)];
  return candidates.find(existsSync);
}

/**
 * Cerca sul filesystem un file di font che corrisponde alla famiglia richiesta.
 *
 * @param family Nome della famiglia tipografica desiderata.
 * @returns Percorso del font trovato o `undefined` se non disponibile.
 */
export function findFontPath(family: string): string | undefined {
  try {
    const matches = readdirSync(paths.fonts)
      .filter((file) => fileNameMatchesFamily(file, family))
      .sort((a, b) => a.localeCompare(b));
    if (!matches.length) return undefined;
    return join(paths.fonts, matches[0]);
  } catch {
    return undefined;
  }
}
