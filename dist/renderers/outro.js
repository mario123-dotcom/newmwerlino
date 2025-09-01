"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderOutroSegment = renderOutroSegment;
const fs_1 = require("fs");
const config_1 = require("../config");
const run_1 = require("../ffmpeg/run");
const text_1 = require("../utils/text");
const config_2 = require("../config");
function renderOutroSegment(seg, outPath, opts) {
    const { fps, videoW, videoH, fontPath, logoPath } = opts;
    const text = seg.text || "";
    const args = [
        "-y",
        "-f", "lavfi", "-t", `${seg.duration}`, "-r", `${fps}`,
        "-i", `color=c=black:s=${videoW}x${videoH}:r=${fps}`,
        "-f", "lavfi", "-t", `${seg.duration}`,
        "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"
    ];
    const haveLogo = !!(logoPath && (0, fs_1.existsSync)(logoPath));
    if (haveLogo)
        args.push("-i", logoPath);
    // 👉 usa la scala OUTRO in base all’orientamento
    const orientation = (0, config_2.deriveOrientation)(videoW, videoH); // "landscape" | "portrait"
    const outroScale = config_1.SCALES[orientation]?.OUTRO ?? 0.03; // fallback sicuro
    let fontSize = Math.round(videoH * outroScale);
    fontSize = Math.max(28, Math.min(84, fontSize));
    const lineH = Math.round(fontSize * 1.25);
    const OUTRO_GAP = 18;
    const groupH = lineH + OUTRO_GAP + config_1.FOOTER.LOGO_HEIGHT;
    const topY = Math.round((videoH - groupH) / 2);
    const textY = topY + (lineH - 1);
    const logoY = topY + lineH + OUTRO_GAP;
    let fchain = `[0:v]format=rgba[base];` +
        `[base]drawtext=fontfile='${fontPath}':fontsize=${fontSize}:fontcolor=white:` +
        `x=(w-text_w)/2:y=${textY}:text='${(0, text_1.escDrawText)(text)}'[pre]`;
    if (haveLogo) {
        fchain += `;[2:v]scale=-1:${config_1.FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre][lg]overlay=x=(W-w)/2:y=${logoY}[v]`;
    }
    else {
        fchain += `;[pre]null[v]`;
    }
    args.push("-filter_complex", fchain, "-map", "[v]", "-map", "1:a:0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-shortest", outPath);
    (0, run_1.runFFmpeg)(args, "FFmpeg SEG(outro)");
}
