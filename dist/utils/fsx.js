"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
const fs_1 = require("fs");
function ensureDir(dir) {
    if (!(0, fs_1.existsSync)(dir))
        (0, fs_1.mkdirSync)(dir, { recursive: true });
}
