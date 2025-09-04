import { existsSync, mkdirSync } from "fs";

/** Crea la directory se non esiste già (modo ricorsivo). */
export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
