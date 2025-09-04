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

  const respFile = isVertical
    ? "risposta_vertical.json"
    : "risposta_horizontal_filtered.json";
  const tplFile = isVertical ? "template_vertical.json" : "template_horizontal.json";

  const respPath = join(projectRoot, "template", respFile);
  const tplPath = join(projectRoot, "template", tplFile);

  const resp = JSON.parse(readFileSync(respPath, "utf-8"));
  const tpl = JSON.parse(readFileSync(tplPath, "utf-8"));

  return {
    modifications: resp.modifications || {},
    width: tpl.width || resp.width || 1920,
    height: tpl.height || resp.height || 1080,
    frame_rate: tpl.frame_rate || resp.frame_rate || 30,
    duration: tpl.duration || resp.duration || 0,
    output_format: tpl.output_format || resp.output_format,
    fill_color: tpl.fill_color || resp.fill_color,
  };
}
