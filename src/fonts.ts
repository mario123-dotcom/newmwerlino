/**
 * Normalizza il nome di una famiglia tipografica rimuovendo accenti, spazi e
 * caratteri non alfanumerici per confrontarlo con i file scaricati.
 *
 * @param family Nome della famiglia (es. "Open Sans").
 * @returns Stringa minuscola pronta per il match con i nomi file.
 */
export function fontFamilyToFileBase(family: string): string {
  if (!family) return "";
  const normalized = family
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const trimmed = normalized || family.replace(/\s+/g, "").toLowerCase();
  return trimmed;
}

/**
 * Stabilisce se un file di font corrisponde alla famiglia richiesta
 * confrontando la versione normalizzata del nome.
 *
 * @param fileName Nome del file salvato su disco (es. "OpenSans-Regular.ttf").
 * @param family Nome della famiglia ricercata.
 * @returns `true` se il file appartiene alla famiglia indicata.
 */
export function fileNameMatchesFamily(fileName: string, family: string): boolean {
  const base = fontFamilyToFileBase(family);
  if (!base) return false;
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const normalized = fontFamilyToFileBase(withoutExt);
  if (!normalized) return false;
  return normalized === base || normalized.startsWith(base);
}
