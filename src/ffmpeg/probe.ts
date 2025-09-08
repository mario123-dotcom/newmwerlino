import { spawnSync } from "child_process";

export function probeDurationSec(filePath: string): number {
  if (!filePath) return 0;
  const args = [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "json",
    filePath,
  ];
  const res = spawnSync("ffprobe", args, { encoding: "utf8" });
  if (res.status !== 0) return 0;

  try {
    const json = JSON.parse(res.stdout || "{}");
    const d = Number(json?.format?.duration);
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}
