"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetLocalAsset = GetLocalAsset;
const fs_1 = require("fs");
const path_1 = require("path");
const paths_1 = require("./paths");
function GetLocalAsset(type, idx) {
    try {
        if (type === "img") {
            const cands = [".jpg", ".jpeg", ".png", ".webp"].map((e) => (0, path_1.join)(paths_1.paths.images, `img${idx}${e}`));
            const found = cands.find((f) => (0, fs_1.existsSync)(f));
            if (found)
                return found;
        }
        if (type === "tts") {
            const f1 = (0, path_1.join)(paths_1.paths.tts, `tts${idx}.mp3`);
            const f2 = (0, path_1.join)(paths_1.paths.tts, `tts-${idx}.mp3`);
            if ((0, fs_1.existsSync)(f1))
                return f1;
            if ((0, fs_1.existsSync)(f2))
                return f2;
            const all = (0, fs_1.readdirSync)(paths_1.paths.tts).filter((n) => n.endsWith(".mp3"));
            const byIdx = all.find((n) => n.endsWith(`-${idx}.mp3`));
            if (byIdx)
                return (0, path_1.join)(paths_1.paths.tts, byIdx);
        }
        if (type === "audio") {
            const f = (0, path_1.join)(paths_1.paths.audio, "bg.mp3");
            return (0, fs_1.existsSync)(f) ? f : null;
        }
        if (type === "logo") {
            const f = (0, path_1.join)(paths_1.paths.images, "logo.png");
            return (0, fs_1.existsSync)(f) ? f : null;
        }
    }
    catch { }
    return null;
}
