#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const config_1 = require("./config");
const paths_1 = require("./paths");
const template_1 = require("./template");
const timeline_1 = require("./timeline");
const assets_1 = require("./assets");
const image_1 = require("./renderers/image");
const filler_1 = require("./renderers/filler");
const outro_1 = require("./renderers/outro");
const validate_1 = require("./validate");
const concat_1 = require("./concat");
const cli_1 = require("./cli");
const fetchAssets_1 = require("./fetchAssets");
(async () => {
    console.log("[LOG] Recupero asset dal template...");
    await (0, fetchAssets_1.fetchAssets)(); // <<--- scarica tutti i file prima
    console.log("[LOG] Asset pronti, procedo al rendering.");
    console.log("[LOG] Reading JSON template...");
    const data = (0, template_1.loadTemplate)();
    const mods = data.modifications || {};
    const videoW = data.width || 1920;
    const videoH = data.height || 1080;
    const fps = data.frame_rate || 30;
    // font
    const fontFiles = (0, fs_1.readdirSync)(paths_1.paths.fonts).filter((f) => /\.(ttf|otf)$/i.test(f));
    if (!fontFiles.length) {
        console.error("[ERROR] No fonts in fonts/");
        process.exit(1);
    }
    let fontPath = (0, path_1.join)(paths_1.paths.fonts, fontFiles[0]).replace(/\\/g, "/");
    if (process.platform === "win32")
        fontPath = fontPath.replace(/^([A-Za-z]):\//, (_, d) => `${d}\\:/`);
    console.log("[LOG] Using font:", fontPath);
    // logo
    const logoPath = (0, assets_1.GetLocalAsset)("logo") || "";
    // BG volume da JSON
    const bgVolFromJson = (() => {
        const v = String(mods["Audio.volume"] ?? "").trim();
        const m = v.match(/([\d.]+)\s*%/);
        if (m)
            return Math.max(0, Math.min(1, parseFloat(m[1]) / 100));
        return config_1.DEFAULT_BG_VOL;
    })();
    // timeline
    const timeline = (0, timeline_1.buildTimeline)(mods);
    console.log("[LOG] Timeline:");
    timeline.forEach((seg) => {
        const label = seg.kind === "image" ? `image #${seg.index}` : seg.kind;
        console.log(` • ${label} dur=${seg.duration.toFixed(3)}s`);
    });
    // render o riuso
    let segFiles = [];
    if (cli_1.REUSE_SEGS) {
        const dir = cli_1.SEGS_DIR || paths_1.paths.temp;
        const found = (0, fs_1.readdirSync)(dir)
            .filter((n) => /^seg\d+\.(mp4|mov|mkv)$/i.test(n))
            .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
            .map((n) => (0, path_1.join)(dir, n));
        if (!found.length) {
            console.error(`--reuse-segs attivo ma nessun segmento trovato in: ${dir}`);
            process.exit(1);
        }
        console.log(`♻️  Riutilizzo ${found.length} segmenti da ${dir}`);
        segFiles = found;
    }
    else {
        timeline.forEach((seg, idx) => {
            const out = (0, path_1.join)(paths_1.paths.temp, `seg${idx}.mp4`);
            if (seg.kind === "image")
                (0, image_1.renderImageSeg)(seg, out, { fps, videoW, videoH, fontPath, logoPath });
            else if (seg.kind === "filler")
                (0, filler_1.renderFillerSegment)(seg, out, { fps, videoW, videoH, logoPath });
            else
                (0, outro_1.renderOutroSegment)(seg, out, {
                    fps,
                    videoW,
                    videoH,
                    fontPath,
                    logoPath,
                });
            segFiles.push(out);
            console.log(`[OK ] Segmento creato: ${out}`);
        });
    }
    // validazione/repair
    const goodSegs = (0, validate_1.validateAndRepairSegments)(segFiles);
    // concat finale
    try {
        (0, concat_1.concatAndFinalizeDemuxer)({
            segments: goodSegs,
            bgAudioPath: (0, assets_1.GetLocalAsset)("audio") || undefined,
            outPath: paths_1.paths.final,
            concatTxtPath: paths_1.paths.concat,
            fps,
            bgVolume: bgVolFromJson,
        });
        console.log(`✅ Video finale creato in ${paths_1.paths.final}`);
    }
    catch (err) {
        console.error("[ERROR] Finalizzazione fallita:", err);
        console.error("Verifica che i segmenti abbiano audio (anche silenzioso) e che il bg esista.");
    }
})();
