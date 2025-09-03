export function wrapParagraph(text: string, width = 30): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line: string[] = [];
  for (const w of words) {
    const test = [...line, w].join(" ");
    if (test.length > width && line.length) {
      lines.push(line.join(" "));
      line = [w];
    } else line.push(w);
  }
  if (line.length) lines.push(line.join(" "));

  if (!lines.length) return [""];

  const HANGABLE = new Set(["con"]);

  for (let i = 0; i < lines.length - 1; i++) {
    const parts = lines[i].split(" ");
    const last = parts[parts.length - 1]?.toLowerCase();
    if (last && HANGABLE.has(last)) {
      const moved = parts.pop()!;
      lines[i] = parts.join(" ");
      lines[i + 1] = `${moved} ${lines[i + 1]}`.trim();
    }
  }

  while (
    lines.length > 1 &&
    lines[lines.length - 1].length < width * 0.8
  ) {
    const prev = lines[lines.length - 2].split(" ");
    const moved = prev.pop();
    if (!moved) break;
    lines[lines.length - 2] = prev.join(" ");
    lines[lines.length - 1] = `${moved} ${lines[lines.length - 1]}`.trim();
  }

  return lines.filter(Boolean);
}
export function normalizeQuotes(s: string): string { return String(s).replace(/'/g, "’"); }
export function escDrawText(s: string): string { return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'"); }
