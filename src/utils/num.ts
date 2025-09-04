/** Parse percentage string like "37.5%" into fraction (0-1). */
export function parsePercent(v: string | number): number {
  if (typeof v === "number") return v / 100;
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? 0 : n / 100;
}
