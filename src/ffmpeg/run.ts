import { spawnSync } from "child_process";
import { appendFileSync } from "fs";
import { paths } from "../paths";

const LOG_FILE = "comandi.txt";

/**
 * Invoca l'eseguibile FFmpeg calcolato in "paths" loggando l'intero comando.
 * In caso di errori di esecuzione o di uscita non zero viene sollevata
 * un'eccezione esplicativa per interrompere la pipeline.
 */
export function runFFmpeg(args: string[], label = "FFmpeg") {
  const ff = paths.ffmpeg;
  const cmd = `${ff} ${args.join(" ")}`;
  console.log(`[${label}] ${cmd}`);

  // Salva anche su file
  appendFileSync(LOG_FILE, `[${label}] ${cmd}\n`);

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

/**
 * Esegue un comando generico catturandone l'output, utile per utility come ffprobe.
 */
export function runPipe(cmd: string, args: string[], label: string) {
  const fullCmd = `${cmd} ${args.join(" ")}`;
  console.log(`[${label}] ${fullCmd}`);

  // Salva anche su file
  appendFileSync(LOG_FILE, `[${label}] ${fullCmd}\n`);

  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
}

/**
 * Restituisce `true` quando il processo ha completato con exit code 0.
 */
export function ok(res: ReturnType<typeof spawnSync>) {
  return (res.status ?? 1) === 0;
}
