"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paths = exports.downloadDir = exports.projectRoot = void 0;
const path_1 = require("path");
const fsx_1 = require("./utils/fsx");
exports.projectRoot = (0, path_1.join)(__dirname, "..");
exports.downloadDir = (0, path_1.join)(exports.projectRoot, "download");
exports.paths = {
    images: (0, path_1.join)(exports.downloadDir, "images"),
    tts: (0, path_1.join)(exports.downloadDir, "tts"),
    audio: (0, path_1.join)(exports.downloadDir, "audio"),
    temp: (0, path_1.join)(exports.projectRoot, "src", "temp"),
    output: (0, path_1.join)(exports.projectRoot, "src", "output"),
    fonts: (0, path_1.join)(exports.projectRoot, "fonts"),
    concat: (0, path_1.join)(exports.projectRoot, "src", "temp", "concat.txt"),
    final: (0, path_1.join)(exports.projectRoot, "src", "output", "final_output.mp4"),
};
Object.values(exports.paths).forEach((p) => {
    if (p.endsWith(".txt") || p.endsWith(".mp4"))
        return;
    (0, fsx_1.ensureDir)(p);
});
