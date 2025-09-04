import type { TextTransition } from "./types";
import { TEXT } from "./config";

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

// Template-based configuration
type TemplateName = "tmp1" | "tmp2";

interface TemplateConf {
  textTransition: TextTransition;
  shadeColor: string;
  fillColor: string;
  barColor: string;
  logoPosition: "bottom" | "top-left";
}

const TEMPLATE_MAP: Record<TemplateName, TemplateConf> = {
  tmp1: {
    textTransition: "wipeup",
    shadeColor: "black",
    fillColor: "black",
    barColor: "black",
    logoPosition: "bottom",
  },
  tmp2: {
    textTransition: "wiperight",
    shadeColor: "red",
    fillColor: "red",
    barColor: "red",
    logoPosition: "top-left",
  },
};

const templateOpt = getOpt("template", "tmp1") as TemplateName;
const TEMPLATE_CONF = TEMPLATE_MAP[templateOpt] || TEMPLATE_MAP.tmp1;

if (templateOpt === "tmp2") {
  TEXT.LEFT_MARGIN_P += 0.02;
  TEXT.TOP_MARGIN_P.landscape += 0.02;
  TEXT.TOP_MARGIN_P.portrait += 0.02;
}

export const TEXT_TRANSITION = TEMPLATE_CONF.textTransition;
export const SHADE_COLOR = TEMPLATE_CONF.shadeColor;
export const FILL_COLOR = TEMPLATE_CONF.fillColor;
export const LOGO_POSITION = TEMPLATE_CONF.logoPosition;
const barColorOpt = getOpt("barColor");
export const BAR_COLOR = barColorOpt || TEMPLATE_CONF.barColor;

