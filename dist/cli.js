"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEGS_DIR = exports.REUSE_SEGS = void 0;
exports.hasFlag = hasFlag;
exports.getOpt = getOpt;
const ARGV = process.argv.slice(2);
function hasFlag(name) {
    return ARGV.includes(`--${name}`) || process.env[name.toUpperCase()] === "1";
}
function getOpt(name, def) {
    const i = ARGV.indexOf(`--${name}`);
    if (i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith("--"))
        return ARGV[i + 1];
    return process.env[name.toUpperCase()] ?? def;
}
exports.REUSE_SEGS = hasFlag("reuse-segs") || hasFlag("reuseSegs") || hasFlag("reuse");
exports.SEGS_DIR = getOpt("segsDir");
