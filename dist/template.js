"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTemplate = loadTemplate;
const fs_1 = require("fs");
const path_1 = require("path");
const paths_1 = require("./paths");
function loadTemplate() {
    const tpl = (0, path_1.join)(paths_1.projectRoot, "template", "risposta_horizontal.json");
    const raw = (0, fs_1.readFileSync)(tpl, "utf-8");
    return JSON.parse(raw);
}
