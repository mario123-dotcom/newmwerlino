"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderImageSeg = renderImageSeg;
const fs_1 = require("fs");
const config_1 = require("../config");
const run_1 = require("../ffmpeg/run");
const filters_1 = require("../ffmpeg/filters");
function renderImageSeg(seg, outPath, opts) {
    if (!seg.img)
        throw new Error(`Image file missing for slide ${seg.index}`);
    const { fps, videoW, videoH, fontPath, logoPath } = opts;
    const isFirst = seg.index === 0;
    const textColor = isFirst ? "black" : "white";
    const shadeStrength = isFirst && !config_1.SHADE.enableOnFirstSlide ? 0 : config_1.SHADE.strength;
    const revealChain = isFirst
        ? (0, filters_1.buildFirstSlideTextChain)(seg.text || "", seg.duration, fontPath, videoW, videoH, fps, textColor)
        : (0, filters_1.buildRevealTextChain_XFADE)(seg.text || "", seg.duration, fontPath, videoW, videoH, fps, textColor, "wipeup", "center");
    const args = ["-y", "-loop", "1", "-t", `${seg.duration}`, "-r", `${fps}`, "-i", seg.img];
    if (seg.tts && (0, fs_1.existsSync)(seg.tts))
        args.push("-i", seg.tts);
    else
        args.push("-f", "lavfi", "-t", `${seg.duration}`, "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    args.push("-f", "lavfi", "-t", `${seg.duration}`, "-r", `${fps}`, "-i", `color=c=black:s=${videoW}x${videoH}:r=${fps}`);
    const haveLogo = !!(logoPath && (0, fs_1.existsSync)(logoPath));
    if (haveLogo)
        args.push("-i", logoPath);
    const baseFit = `scale=${videoW}:${videoH}:force_original_aspect_ratio=increase:flags=bicubic+accurate_rnd+full_chroma_int,crop=${videoW}:${videoH}`;
    const zExpr = (0, filters_1.zoomExprFullClip)(seg.duration, fps);
    const move = `zoompan=z=${zExpr}:x=0:y=0:d=1:s=${videoW}x${videoH}:fps=${fps}`;
    let vHead = `[0:v]${baseFit},${move}[base];[2:v]${(0, filters_1.shadeChain)(shadeStrength, config_1.SHADE.gamma)}[shade];[base][shade]overlay=x=0:y=0[pre0]`;
    const lineY = `ih-${config_1.FOOTER.MARGIN_BOTTOM + config_1.FOOTER.LOGO_HEIGHT + config_1.FOOTER.GAP}`;
    let footer = `[pre0]drawbox=x=0:y=${lineY}:w=iw:h=${config_1.FOOTER.LINE_THICKNESS}:color=black@0.95:t=fill[pre1]`;
    if (haveLogo)
        footer += `;[3:v]scale=-1:${config_1.FOOTER.LOGO_HEIGHT},format=rgba[lg];[pre1][lg]overlay=x=(W-w)/2:y=H-h-${config_1.FOOTER.MARGIN_BOTTOM}[pre]`;
    else
        footer += `;[pre1]null[pre]`;
    const vDrawChain = revealChain;
    const aChain = `[1:a]aformat=channel_layouts=stereo:sample_rates=44100,apad,atrim=0:${seg.duration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${config_1.DEFAULT_TTS_VOL}[a]`;
    const fchain = `${vHead};${footer};${vDrawChain};${aChain}`;
    args.push("-filter_complex", fchain, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-shortest", outPath);
    (0, run_1.runFFmpeg)(args, "FFmpeg SEG(image)");
}
