import type { TextTransition } from "./types";

const ARGV = process.argv.slice(2);

export function hasFlag(name: string) {
  return ARGV.includes(`--${name}`) || process.env[name.toUpperCase()] === "1";
}
export function getOpt(name: string, def?: string) {
  const i = ARGV.indexOf(`--${name}`);
  if (i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith("--"))
    return ARGV[i + 1].trim();
  const env = process.env[name.toUpperCase()];
  return env ? env.trim() : def;
}

export const REUSE_SEGS = hasFlag("reuse-segs") || hasFlag("reuseSegs") || hasFlag("reuse");
export const SEGS_DIR = getOpt("segsDir");

export const TEXT_TRANSITION = (getOpt("textTransition", "wipeup") as TextTransition);
