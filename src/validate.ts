import { dirname, parse as parsePath, resolve } from "path";
import { existsSync } from "fs";
import { CONCAT_DEFAULTS } from "./config";
import { ok, runPipe } from "./ffmpeg/run";

/** Esegue `ffprobe` restituendo l'output JSON parsed oppure `null`. */
export function ffprobeJson(file: string): any | null {
  const r = runPipe(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,codec_type,width,height,sample_rate,channels",
      "-show_entries",
      "format=duration,format_name",
      "-of",
      "json",
      file,
    ],
    "ffprobe"
  );
  if (!ok(r)) return null;
  try {
    return JSON.parse(r.stdout || "{}");
  } catch {
    return null;
  }
}

/** Verifica rapidamente se un MP4 contiene tracce video e audio valide. */
export function canOpenMp4(file: string): boolean {
  const j = ffprobeJson(file);
  const hasVideo = j?.streams?.some((s: any) => s.codec_type === "video");
  const hasAudio = j?.streams?.some((s: any) => s.codec_type === "audio");
  return !!(
    hasVideo &&
    hasAudio &&
    Number(j?.format?.duration) >= 0
  );
}

/**
 * Tenta di riparare un segmento MP4 corrotto prima con remux, poi con
 * ricodifica. Restituisce il percorso del file riparato oppure `null`.
 */
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

/**
 * Controlla ogni segmento, prova l'autoriparazione se necessario e restituisce
 * solo i file validi, sollevando errore se nessuno è utilizzabile.
 */
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
