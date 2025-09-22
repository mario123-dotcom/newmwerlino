import { spawnSync } from "child_process";
import { paths } from "../paths";

/**
 * Esegue `ffmpeg` con gli argomenti specificati stampando il comando.
 * Lancia un'eccezione se il processo termina con exit code diverso da 0.
 */
export function runFFmpeg(args: string[], label = "FFmpeg") {
  const ff = paths.ffmpeg;
  const cmd = `${ff} ${args.join(" ")}`;
  console.log(`[${label}] ${cmd}`);

  const res = spawnSync(ff, args, { stdio: "inherit" });

  if (res.error) {
    const code = (res.error as any).code;
    if (code === "ENOENT") {
      throw new Error(`${label} failed: ffmpeg not installed or not in PATH`);
    }
    throw new Error(`${label} failed: ${res.error.message}`);
  }

  if ((res.status ?? 1) !== 0) {
    throw new Error(`${label} failed (exit ${res.status ?? "unknown"})`);
  }
}

/** Esegue un comando e restituisce stdout/stderr senza stream diretti. */
export function runPipe(cmd: string, args: string[], label: string) {
  const fullCmd = `${cmd} ${args.join(" ")}`;
  console.log(`[${label}] ${fullCmd}`);

  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
}

/** Ritorna `true` se il comando è terminato con successo. */
export function ok(res: ReturnType<typeof spawnSync>) {
  return (res.status ?? 1) === 0;
}
