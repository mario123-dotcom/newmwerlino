export function wrapParagraph(text: string, width = 30): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = []; let line: string[] = [];
  for (const w of words) {
    const test = [...line, w].join(" ");
    if (test.length > width && line.length) { lines.push(line.join(" ")); line = [w]; }
    else line.push(w);
  }
  if (line.length) lines.push(line.join(" "));
  return lines.length ? lines : [""];
}
export function normalizeQuotes(s: string): string { return String(s).replace(/'/g, "’"); }
export function escDrawText(s: string): string { return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'"); }
