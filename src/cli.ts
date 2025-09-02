import type { TextTransition } from "./types";

const ARGV = process.argv.slice(2);

function readEnv(name: string) {
  return (
    process.env[name.toUpperCase()] ??
    process.env[`npm_config_${name}`] ??
    process.env[`npm_config_${name.toLowerCase()}`]
  );
}

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
  if (npmArgvVal && npmArgvVal !== "true" && npmArgvVal !== "1") return npmArgvVal;
  if ((env === "true" || env === "1") && ARGV.length && !ARGV[0].startsWith("--"))
    return ARGV[0].trim();
  return def;

}

export const REUSE_SEGS = hasFlag("reuse-segs") || hasFlag("reuseSegs") || hasFlag("reuse");
export const SEGS_DIR = getOpt("segsDir");

export const TEXT_TRANSITION = (getOpt("textTransition", "wipeup") as TextTransition);

