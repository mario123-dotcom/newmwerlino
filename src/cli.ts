import type { TextTransition } from "./types";

const ARGV = process.argv.slice(2);

function readEnv(name: string) {
  return (
    process.env[name.toUpperCase()] ??
    process.env[`npm_config_${name}`] ??
    process.env[`npm_config_${name.toLowerCase()}`]
  );
}


function readFromNpmArgv(name: string) {
  try {
    const raw = process.env.npm_config_argv;
    if (!raw) return;
    const parsed = JSON.parse(raw) as { cooked?: string[]; original?: string[] };
    const arr = parsed?.original ?? parsed?.cooked ?? [];
    const idx = arr.indexOf(`--${name}`);
    if (idx >= 0 && arr[idx + 1] && !arr[idx + 1].startsWith("--")) {
      return arr[idx + 1].trim();
    }
  } catch {
    // ignore
  }
}


export function hasFlag(name: string) {
  const env = readEnv(name);
  return ARGV.includes(`--${name}`) || env === "1" || env === "true";
}
export function getOpt(name: string, def?: string) {
  const i = ARGV.indexOf(`--${name}`);
  if (i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith("--"))
    return ARGV[i + 1].trim();
  const env = readEnv(name);
  if (env && env !== "true" && env !== "1") return env.trim();
  const npmArgvVal = readFromNpmArgv(name);
  return npmArgvVal ?? def;

}

export const REUSE_SEGS = hasFlag("reuse-segs") || hasFlag("reuseSegs") || hasFlag("reuse");
export const SEGS_DIR = getOpt("segsDir");

export const TEXT_TRANSITION = (getOpt("textTransition", "wipeup") as TextTransition);

