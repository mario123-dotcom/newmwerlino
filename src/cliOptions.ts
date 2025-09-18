const LOCAL_TOKENS = new Set(["--local", "-local", "local"]);

function isLocalToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  return LOCAL_TOKENS.has(normalized);
}

function fromArgv(argv: string[] | undefined): boolean {
  if (!Array.isArray(argv)) {
    return false;
  }
  return argv.some((token) => typeof token === "string" && isLocalToken(token));
}

function fromEnvFlag(flag: string | undefined): boolean {
  if (!flag) {
    return false;
  }
  const normalized = flag.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function fromNpmConfigArgv(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    if (fromArgv(parsed?.remain)) return true;
    if (fromArgv(parsed?.cooked)) return true;
    if (fromArgv(parsed?.original)) return true;
  } catch (err) {
    console.warn("Impossibile leggere npm_config_argv:", err);
  }
  return false;
}

export type CliOptions = {
  localOnly: boolean;
};

type EnvLike = Record<string, string | undefined>;

export function resolveCliOptions(argv: string[], env: EnvLike): CliOptions {
  if (fromArgv(argv)) {
    return { localOnly: true };
  }
  if (fromEnvFlag(env.npm_config_local)) {
    return { localOnly: true };
  }
  if (fromNpmConfigArgv(env.npm_config_argv)) {
    return { localOnly: true };
  }
  return { localOnly: false };
}
