"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ffprobeJson = ffprobeJson;
exports.canOpenMp4 = canOpenMp4;
exports.tryRepairSegment = tryRepairSegment;
exports.validateAndRepairSegments = validateAndRepairSegments;
const path_1 = require("path");
const config_1 = require("./config");
const run_1 = require("./ffmpeg/run");
function ffprobeJson(file) {
    const r = (0, run_1.runPipe)("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,codec_type,width,height", "-show_entries", "format=duration,format_name", "-of", "json", file], "ffprobe");
    if (!(0, run_1.ok)(r))
        return null;
    try {
        return JSON.parse(r.stdout || "{}");
    }
    catch {
        return null;
    }
}
function canOpenMp4(file) {
    const j = ffprobeJson(file);
    return !!(j && Array.isArray(j.streams) && j.streams.length && Number(j.format?.duration) >= 0);
}
function tryRepairSegment(inputAbs) {
    const { dir, name } = (0, path_1.parse)(inputAbs);
    const out1 = (0, path_1.resolve)(dir, `${name}.remux.mp4`);
    const out2 = (0, path_1.resolve)(dir, `${name}.reenc.mp4`);
    let r = (0, run_1.runPipe)("ffmpeg", ["-y", "-v", "error", "-fflags", "+genpts", "-i", inputAbs, "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", out1], "ffmpeg-REMUX");
    if ((0, run_1.ok)(r) && canOpenMp4(out1))
        return out1;
    r = (0, run_1.runPipe)("ffmpeg", ["-y", "-v", "error", "-fflags", "+genpts", "-i", inputAbs, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", out2], "ffmpeg-REENC");
    if ((0, run_1.ok)(r) && canOpenMp4(out2))
        return out2;
    return null;
}
function validateAndRepairSegments(inputs) {
    const good = [];
    for (const f of inputs) {
        if (canOpenMp4(f)) {
            good.push(f);
            continue;
        }
        console.warn(`⚠️  Segmento illeggibile: ${f}`);
        if (config_1.CONCAT_DEFAULTS.tryAutoRepair) {
            console.warn(`   → Provo autoriparazione …`);
            const repaired = tryRepairSegment(f);
            if (repaired && canOpenMp4(repaired)) {
                console.warn(`   ✅ Riparato: ${repaired}`);
                good.push(repaired);
                continue;
            }
            console.warn(`   ❌ Riparazione fallita`);
        }
        if (!config_1.CONCAT_DEFAULTS.allowSkipBroken) {
            throw new Error(`Segmento corrotto e non skippabile: ${f}`);
        }
        console.warn(`   ↷ Skipping ${f}`);
    }
    if (!good.length) {
        throw new Error(`Nessun segmento valido dopo verifica/repair`);
    }
    console.log(`🔎 Segmenti validi (${good.length}):`);
    good.forEach((f) => console.log(" •", f));
    return good;
}
