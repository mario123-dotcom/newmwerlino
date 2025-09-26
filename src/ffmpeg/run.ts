import { spawnSync } from "child_process";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { paths } from "../paths";

function shellQuote(arg: string): string {
  if (arg === "") {
    return "''";
  }

  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) {
    return arg;
  }

  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function appendCommandToLog(command: string) {
  const logFile = paths.ffmpegLog;
  try {
    const dir = dirname(logFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    appendFileSync(logFile, `${command}\n`, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[FFmpeg] Unable to write command log: ${message}`);
  }
}

/**
 * Esegue `ffmpeg` con gli argomenti specificati stampando il comando.
 * Lancia un'eccezione se il processo termina con exit code diverso da 0.
 *
 * @param args Array di argomenti da passare al binario FFmpeg.
 * @param label Etichetta mostrata nei log per identificare l'operazione.
 */
export function runFFmpeg(args: string[], label = "FFmpeg") {
  const ff = paths.ffmpeg;
  const printable = [ff, ...args].map(shellQuote).join(" ");

  console.log(`[${label}] ${printable}`);
  appendCommandToLog(printable);

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
 * Esegue un comando e restituisce stdout/stderr senza stream diretti.
 *
 * @param cmd Nome del comando da eseguire.
 * @param args Argomenti da passare al processo.
 * @param label Etichetta di log da mostrare in console.
 * @returns Risultato di `spawnSync` con buffer in memoria.
 */
export function runPipe(cmd: string, args: string[], label: string) {
  const fullCmd = `${cmd} ${args.join(" ")}`;
  console.log(`[${label}] ${fullCmd}`);

  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
}

/**
 * Ritorna `true` se il comando è terminato con successo.
 *
 * @param res Oggetto risultato di `spawnSync`.
 * @returns `true` se l'exit code è 0.
 */
export function ok(res: ReturnType<typeof spawnSync>) {
  return (res.status ?? 1) === 0;
}
