import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "./paths";
import { FullData } from "./types";
import { getOpt, hasFlag } from "./cli";
import { generateFilteredTemplate } from "./tools/genTemplate";

/**
 * Carica il file di template JSON (versione orizzontale o verticale) e lo
 * deserializza in un oggetto `FullData`.
 */
export function loadTemplate(): FullData {
  const fmtOpt = getOpt("format");
  const isVertical = fmtOpt === "vertical" || hasFlag("vertical");
  if (!isVertical) generateFilteredTemplate();
  const file = isVertical ? "risposta_vertical.json" : "risposta_horizontal_filtered.json";
  const tpl = join(projectRoot, "template", file);
  const raw = readFileSync(tpl, "utf-8");
  return JSON.parse(raw) as FullData;
}
