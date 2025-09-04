import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { parseSec } from "../utils/time";
import { projectRoot } from "../paths";

/**
 * Return indices of slides that are actually used.
 * A slide is used when it has an image entry and it's not explicitly
 * hidden or of zero duration.
 */
export function collectUsedSlides(mods: Record<string, any>): number[] {
  const used: number[] = [];
  for (let i = 0; ; i++) {
    const imgKey = `Immagine-${i}`;
    if (!(imgKey in mods)) break;
    const visible = mods[`Slide_${i}.visible`];
    const dur =
      parseSec(mods[`Slide_${i}.duration`]) ||
      parseSec(mods[`TTS-${i}.duration`]);
    if (visible === false || dur <= 0) continue;
    used.push(i);
  }
  return used;
}

/** Recursively collect shape elements from Creatomate template. */
function gatherShapes(node: any, acc: any[]) {
  if (!node) return;
  if (node.type === "shape" && typeof node.path === "string") {
    acc.push(node);
  }
  if (Array.isArray(node.elements)) node.elements.forEach((e) => gatherShapes(e, acc));
}

/** Generate a simplified template with only used elements and export SVGs. */
export function generateFilteredTemplate() {
  const tplPath = join(projectRoot, "template", "template_horizontal.json");
  const respPath = join(projectRoot, "template", "risposta_horizontal.json");

  const tpl = JSON.parse(readFileSync(tplPath, "utf8"));
  const resp = JSON.parse(readFileSync(respPath, "utf8"));
  const mods: Record<string, any> = resp.modifications || {};

  const usedSlides = collectUsedSlides(mods);
  const filtered: Record<string, any> = {};

  // copia tutte le modifiche mantenendo soltanto quelle relative alle slide effettivamente usate
  for (const [key, val] of Object.entries(mods)) {
    const m = key.match(/-(\d+)/) || key.match(/_(\d+)\./);
    if (m) {
      const idx = parseInt(m[1]!, 10);
      if (!usedSlides.includes(idx)) continue;
    }
    filtered[key] = val;
  }

  const outPath = join(projectRoot, "template", "risposta_horizontal_filtered.json");
  const newData = { ...resp, modifications: filtered };
  writeFileSync(outPath, JSON.stringify(newData, null, 2), "utf8");

  // Export SVGs from template shapes
  const svgDir = join(projectRoot, "template", "svg");
  mkdirSync(svgDir, { recursive: true });
  const shapes: any[] = [];
  gatherShapes(tpl, shapes);
  shapes.forEach((s) => {
    const rawColor = Array.isArray(s.fill_color)
      ? s.fill_color[0]?.color || "#000"
      : s.fill_color || "#000";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n` +
      `<path d="${s.path}" fill="${rawColor}"/>\n` +
      `</svg>\n`;
    const name = String(s.name || s.id || "shape").replace(/[^a-zA-Z0-9_-]/g, "_");
    writeFileSync(join(svgDir, `${name}.svg`), svg, "utf8");
  });
}

if (require.main === module) {
  generateFilteredTemplate();
}
