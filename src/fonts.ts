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

const NAMED_FONT_WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  "extra-light": 200,
  "extra light": 200,
  ultralight: 200,
  "ultra-light": 200,
  "ultra light": 200,
  light: 300,
  normal: 400,
  regular: 400,
  medium: 500,
  semibold: 600,
  "semi-bold": 600,
  "semi bold": 600,
  demibold: 600,
  "demi-bold": 600,
  "demi bold": 600,
  bold: 700,
  extrabold: 800,
  "extra-bold": 800,
  "extra bold": 800,
  ultrabold: 800,
  "ultra-bold": 800,
  "ultra bold": 800,
  black: 900,
  heavy: 900,
  bheavy: 900,
};

function clampWeight(w: number): number | undefined {
  if (!Number.isFinite(w)) return undefined;
  const rounded = Math.round(w);
  if (rounded < 50 || rounded > 1000) return undefined;
  return rounded;
}

export function parseFontWeight(weight: unknown): number | undefined {
  if (typeof weight === "number") {
    return clampWeight(weight);
  }
  if (typeof weight !== "string") return undefined;
  const trimmed = weight.trim().toLowerCase();
  if (!trimmed) return undefined;
  const named = NAMED_FONT_WEIGHTS[trimmed];
  if (named) return named;
  const numeric = parseFloat(trimmed);
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric > 10 && numeric < 100) {
    // Creatomate a volte esporta 40, 50... interpretali come percentuali.
    return clampWeight(numeric * 10);
  }
  return clampWeight(numeric);
}

export function extractFontWeightFromFileName(fileName: string): number | undefined {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const parts = withoutExt.split("-");
  if (parts.length <= 1) return undefined;

  for (let i = parts.length - 1; i >= 1; i--) {
    const token = parts[i];
    if (!token) continue;
    const weightMatch = token.match(/^w(\d{2,4})$/i);
    if (weightMatch) {
      const parsed = parseInt(weightMatch[1], 10);
      const clamped = clampWeight(parsed);
      if (clamped) return clamped;
    }
    const normalized = token.replace(/[^a-z]/gi, "").toLowerCase();
    if (!normalized) continue;
    const named = NAMED_FONT_WEIGHTS[normalized];
    if (named) return named;
  }

  return undefined;
}
