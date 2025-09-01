import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "./paths";
import { FullData } from "./types";

export function loadTemplate(): FullData {
  const tpl = join(projectRoot, "template", "risposta_horizontal.json");
  const raw = readFileSync(tpl, "utf-8");
  return JSON.parse(raw) as FullData;
}
