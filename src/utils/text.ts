/**
 * Suddivide un paragrafo in righe di lunghezza massima `width`,
 * cercando di bilanciare le ultime righe e gestendo piccole parole
 * da "appendere" (es. preposizioni).
 */
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

/**
 * Ridimensiona il font e applica un semplice word-wrap affinché il testo
 * rientri in un box di dimensioni fissate (in pixel).
 * Restituisce il testo con interruzioni di riga e la dimensione finale.
 */
export function fitText(
  text: string,
  boxW: number,
  boxH: number,
  baseSize: number,
  lineHeight = 1.2,
): { text: string; fontSize: number } {
  let fontSize = Math.max(1, Math.round(baseSize));
  let lines = wrapParagraph(
    text,
    Math.max(1, Math.floor(boxW / (fontSize * 0.6)))
  );
  while (lines.length * fontSize * lineHeight > boxH && fontSize > 10) {
    fontSize -= 2;
    lines = wrapParagraph(
      text,
      Math.max(1, Math.floor(boxW / (fontSize * 0.6)))
    );
  }
  return { text: lines.join("\n"), fontSize };
}

/** Normalizza gli apici semplici rendendoli compatibili con FFmpeg. */
export function normalizeQuotes(s: string): string { return String(s).replace(/'/g, "’"); }

/** Escapa stringhe per l'uso nel filtro `drawtext` di FFmpeg. */
export function escDrawText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,");
}
