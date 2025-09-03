import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "./paths";
import { FullData } from "./types";
import { getOpt, hasFlag } from "./cli";

export function loadTemplate(): FullData {
  const fmtOpt = getOpt("format");
  const isVertical = fmtOpt === "vertical" || hasFlag("vertical");
  const file = isVertical ? "risposta_vertical.json" : "risposta_horizontal.json";
  const tpl = join(projectRoot, "template", file);
  const raw = readFileSync(tpl, "utf-8");
  return JSON.parse(raw) as FullData;
}
