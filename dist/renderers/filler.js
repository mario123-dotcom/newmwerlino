"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFillerSegment = renderFillerSegment;
const fs_1 = require("fs");
const config_1 = require("../config");
const run_1 = require("../ffmpeg/run");
function renderFillerSegment(seg, outPath, opts) {
    const { fps, videoW, videoH, logoPath } = opts;
    const args = ["-y", "-f", "lavfi", "-t", `${seg.duration}`, "-r", `${fps}`, "-i", `color=c=black:s=${videoW}x${videoH}:r=${fps}`,
        "-f", "lavfi", "-t", `${seg.duration}`, "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
    const haveLogo = !!(logoPath && (0, fs_1.existsSync)(logoPath));
    if (haveLogo)
        args.push("-i", logoPath);
    const lineY = `ih-${config_1.FOOTER.MARGIN_BOTTOM + config_1.FOOTER.LOGO_HEIGHT + config_1.FOOTER.GAP}`;
    let fchain = `[0:v]format=rgba[base];[base]drawbox=x=0:y=${lineY}:w=iw:h=${config_1.FOOTER.LINE_THICKNESS}:color=black@0.95:t=fill[pre1]`;
    if (haveLogo)
        fchain += `;[2:v]scale=-1:${config_1.FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre1][lg]overlay=x=(W-w)/2:y=(H-h)/2[v]`;
    else
        fchain += `;[pre1]null[v]`;
    args.push("-filter_complex", fchain, "-map", "[v]", "-map", "1:a:0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-shortest", outPath);
    (0, run_1.runFFmpeg)(args, "FFmpeg SEG(filler)");
}
