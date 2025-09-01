"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.concatAndFinalizeDemuxer = concatAndFinalizeDemuxer;
const fs_1 = require("fs");
const path_1 = require("path");
const fsx_1 = require("./utils/fsx");
const config_1 = require("./config");
const run_1 = require("./ffmpeg/run");
function concatAndFinalizeDemuxer({ segments, bgAudioPath, outPath, concatTxtPath, fps, bgVolume }) {
    // Filelist
    const filelist = segments.map((p) => {
        const abs = (0, path_1.resolve)(p).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        return `file '${abs}'`;
    }).join("\n");
    (0, fsx_1.ensureDir)((0, path_1.dirname)(concatTxtPath));
    (0, fs_1.writeFileSync)(concatTxtPath, filelist, "utf8");
    const haveBg = !!(bgAudioPath && (0, fs_1.existsSync)(bgAudioPath));
    const args = ["-y", "-fflags", "+genpts", "-f", "concat", "-safe", "0", "-i", concatTxtPath];
    if (haveBg)
        args.push("-stream_loop", "-1", "-i", bgAudioPath);
    const baseAudio = `[0:a:0]aformat=channel_layouts=stereo:sample_rates=44100,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[acat]`;
    const audioChain = haveBg
        ? [
            baseAudio,
            `[1:a:0]aformat=channel_layouts=stereo:sample_rates=44100,volume=${bgVolume}[bg]`,
            `[bg][acat]sidechaincompress=threshold=${config_1.DUCK.threshold}:ratio=${config_1.DUCK.ratio}:attack=${config_1.DUCK.attack}:release=${config_1.DUCK.release}:makeup=${config_1.DUCK.makeup}[bgduck]`,
            `[acat][bgduck]amix=inputs=2:normalize=0:duration=longest:dropout_transition=0[mix]`
        ].join(";")
        : `${baseAudio};[acat]anull[mix]`;
    args.push("-filter_complex", audioChain, "-map", "0:v:0", "-map", "[mix]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", "-r", String(fps), "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", "-shortest", outPath);
    console.log("[DBG ] CONCAT (demuxer) filelist:\n" + filelist + "\n");
    console.log("[DBG ] FINAL filter_complex:\n" + audioChain + "\n");
    (0, run_1.runFFmpeg)(args, "FFmpeg FINAL (demuxer concat)");
}
