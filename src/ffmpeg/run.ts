import { spawnSync } from "child_process";
import { appendFileSync } from "fs";

const LOG_FILE = "comandi.txt";

export function runFFmpeg(args: string[], label = "FFmpeg") {
  const cmd = `ffmpeg ${args.join(" ")}`;
  console.log(`[${label}] ${cmd}`);

  // Salva anche su file
  appendFileSync(LOG_FILE, `[${label}] ${cmd}\n`);

  const res = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (res.status !== 0) throw new Error(`${label} failed (exit ${res.status ?? "unknown"})`);
}

export function runPipe(cmd: string, args: string[], label: string) {
  const fullCmd = `${cmd} ${args.join(" ")}`;
  console.log(`[${label}] ${fullCmd}`);

  // Salva anche su file
  appendFileSync(LOG_FILE, `[${label}] ${fullCmd}\n`);

  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
}

export function ok(res: ReturnType<typeof spawnSync>) {
  return (res.status ?? 1) === 0;
}
