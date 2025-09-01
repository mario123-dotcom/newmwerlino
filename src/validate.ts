import { dirname, parse as parsePath, resolve } from "path";
import { existsSync } from "fs";
import { CONCAT_DEFAULTS } from "./config";
import { ok, runPipe } from "./ffmpeg/run";

export function ffprobeJson(file: string): any | null {
  const r = runPipe("ffprobe",
    ["-v","error","-select_streams","v:0","-show_entries","stream=codec_name,codec_type,width,height","-show_entries","format=duration,format_name","-of","json",file],
    "ffprobe");
  if (!ok(r)) return null;
  try { return JSON.parse(r.stdout || "{}"); } catch { return null; }
}

export function canOpenMp4(file: string): boolean {
  const j = ffprobeJson(file);
  return !!(j && Array.isArray(j.streams) && j.streams.length && Number(j.format?.duration) >= 0);
}

export function tryRepairSegment(inputAbs: string): string | null {
  const { dir, name } = parsePath(inputAbs);
  const out1 = resolve(dir, `${name}.remux.mp4`);
  const out2 = resolve(dir, `${name}.reenc.mp4`);
  let r = runPipe("ffmpeg", ["-y","-v","error","-fflags","+genpts","-i",inputAbs,"-c:v","copy","-c:a","copy","-movflags","+faststart",out1], "ffmpeg-REMUX");
  if (ok(r) && canOpenMp4(out1)) return out1;
  r = runPipe("ffmpeg", ["-y","-v","error","-fflags","+genpts","-i",inputAbs,"-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-ar","44100","-ac","2","-movflags","+faststart",out2], "ffmpeg-REENC");
  if (ok(r) && canOpenMp4(out2)) return out2;
  return null;
}

export function validateAndRepairSegments(inputs: string[]): string[] {
  const good: string[] = [];
  for (const f of inputs) {
    if (canOpenMp4(f)) { good.push(f); continue; }
    console.warn(`⚠️  Segmento illeggibile: ${f}`);
    if (CONCAT_DEFAULTS.tryAutoRepair) {
      console.warn(`   → Provo autoriparazione …`);
      const repaired = tryRepairSegment(f);
      if (repaired && canOpenMp4(repaired)) { console.warn(`   ✅ Riparato: ${repaired}`); good.push(repaired); continue; }
      console.warn(`   ❌ Riparazione fallita`);
    }
    if (!CONCAT_DEFAULTS.allowSkipBroken) { throw new Error(`Segmento corrotto e non skippabile: ${f}`); }
    console.warn(`   ↷ Skipping ${f}`);
  }
  if (!good.length) { throw new Error(`Nessun segmento valido dopo verifica/repair`); }
  console.log(`🔎 Segmenti validi (${good.length}):`); good.forEach((f) => console.log(" •", f));
  return good;
}
