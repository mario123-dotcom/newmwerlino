import type { TextTransition } from "./types";
import { TEXT } from "./config";
import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "./paths";

const ARGV = process.argv.slice(2);

/** Legge una variabile d'ambiente gestendo anche i nomi usati da npm. */
function readEnv(name: string) {
  return (
    process.env[name.toUpperCase()] ??
    process.env[`npm_config_${name}`] ??
    process.env[`npm_config_${name.toLowerCase()}`]
  );
}

/** Estrae l'argomento dalla variabile d'ambiente `npm_config_argv`. */
function readFromNpmArgv(name: string): string | undefined {
  try {
    const raw = process.env.npm_config_argv;
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const remain: string[] = parsed.remain || parsed.original || [];
    const flag = `--${name}`;
    const idx = remain.indexOf(flag);
    if (idx >= 0 && remain[idx + 1] && !remain[idx + 1].startsWith("--"))
      return remain[idx + 1];
    const idxBare = remain.indexOf(name);
    if (idxBare >= 0 && remain[idxBare + 1] && !remain[idxBare + 1].startsWith("--"))
      return remain[idxBare + 1];
  } catch {
    // ignore
  }
  return undefined;
}




/** Verifica la presenza di un flag booleano passato via CLI o env. */
export function hasFlag(name: string) {
  const env = readEnv(name);
  return ARGV.includes(`--${name}`) || env === "1" || env === "true";
}
/**
 * Restituisce il valore di un'opzione stringa. L'ordine di ricerca è:
 * 1. flag CLI `--nome val`
 * 2. variabili d'ambiente/`npm_config`
 * 3. argomenti residui di npm (`npm_config_argv`)
 * 4. primo argomento non flag se la variabile è booleana
 * 5. valore di default
 */
export function getOpt(name: string, def?: string) {
  const i = ARGV.indexOf(`--${name}`);
  if (i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith("--"))
    return ARGV[i + 1].trim();
  const env = readEnv(name);
  if (env && env !== "true" && env !== "1") return env.trim();
  const npmArgvVal = readFromNpmArgv(name);
  if (npmArgvVal && npmArgvVal !== "true" && npmArgvVal !== "1") return npmArgvVal;
  if ((env === "true" || env === "1") && ARGV.length && !ARGV[0].startsWith("--"))
    return ARGV[0].trim();
  return def;

}

export const REUSE_SEGS = hasFlag("reuse-segs") || hasFlag("reuseSegs") || hasFlag("reuse");
export const SEGS_DIR = getOpt("segsDir");

// Configuration derived from Creatomate template
function findFirstWipe(node: any): any | undefined {
  if (!node) return undefined;
  if (Array.isArray(node.animations)) {
    const wipe = node.animations.find((a: any) => a.type === "wipe");
    if (wipe) return wipe;
  }
  if (Array.isArray(node.elements)) {
    for (const el of node.elements) {
      const res = findFirstWipe(el);
      if (res) return res;
    }
  }
  return undefined;
}

function readTemplateSettings() {
  try {
    const raw = readFileSync(
      join(projectRoot, "template", "creatomate_template_news_horizontal.json"),
      "utf8"
    );
    const data = JSON.parse(raw);
    const wipe = findFirstWipe(data);
    let textTransition: TextTransition = "wipeup";
    if (wipe) {
      if (wipe.x_anchor === "0%") textTransition = "wiperight";
      else if (wipe.x_anchor === "100%") textTransition = "wipeleft";
      else if (wipe.y_anchor === "0%") textTransition = "wipedown";
      else if (wipe.y_anchor === "100%") textTransition = "wipeup";
    }
    const fillColor = data.fill_color || "black";
    return { textTransition, fillColor };
  } catch {
    return { textTransition: "wipeup" as TextTransition, fillColor: "black" };
  }
}

const tpl = readTemplateSettings();

export const TEXT_TRANSITION: TextTransition = tpl.textTransition;
export const SHADE_COLOR = "black";
export const FILL_COLOR = tpl.fillColor;
export const LOGO_POSITION = "bottom";
const barColorOpt = getOpt("barColor");
export const BAR_COLOR = barColorOpt || tpl.fillColor;

