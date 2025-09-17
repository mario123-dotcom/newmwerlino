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

export function fileNameMatchesFamily(fileName: string, family: string): boolean {
  const base = fontFamilyToFileBase(family);
  if (!base) return false;
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const normalized = fontFamilyToFileBase(withoutExt);
  if (!normalized) return false;
  return normalized === base || normalized.startsWith(base);
}
