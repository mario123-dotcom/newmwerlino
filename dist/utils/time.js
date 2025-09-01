"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.djitter = djitter;
exports.parseSec = parseSec;
exports.lineOffset = lineOffset;
const config_1 = require("../config");
function djitter(i) {
    const x = Math.sin(i * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
}
function parseSec(v, def = 0) {
    if (v == null)
        return def;
    if (typeof v === "number" && isFinite(v))
        return v;
    const s = String(v).trim();
    const m = s.match(/([\d.,]+)/);
    if (!m)
        return def;
    return parseFloat(m[1].replace(",", ".")) || def;
}
function lineOffset(i, segDur, animDur) {
    const t = config_1.STAGGER.base * i + config_1.STAGGER.growth * (i * (i - 1)) / 2;
    const j = (djitter(i) * 2 - 1) * config_1.STAGGER.jitter;
    const off = Math.max(0, Math.min(segDur - animDur, t + j));
    return Number(off.toFixed(3));
}
