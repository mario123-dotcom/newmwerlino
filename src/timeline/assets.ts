import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { paths } from "../paths";
import { fileNameMatchesFamily } from "../fonts";

export function ensureTempDir(): void {
  try {
    mkdirSync(paths.temp, { recursive: true });
  } catch {}
}

export function writeTextFilesForSlide(index: number, lines: string[]): string[] {
  ensureTempDir();
  return lines.map((text, lineIndex) => {
    const filePath = join(paths.temp, `dtxt-${String(index).padStart(3, "0")}-${lineIndex}.txt`);
    writeFileSync(filePath, String(text ?? ""), "utf8");
    return filePath;
  });
}

export function findImageForSlide(index: number): string | undefined {
  const base = paths.images;
  const candidates = [
    join(base, `img${index}.jpeg`),
    join(base, `img${index}.jpg`),
    join(base, `img${index}.png`),
  ];
  return candidates.find(existsSync);
}

export function findTTSForSlide(index: number): string | undefined {
  const base = paths.tts;
  const candidates = [join(base, `tts-${index}.mp3`)];
  return candidates.find(existsSync);
}

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
