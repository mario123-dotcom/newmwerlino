"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFFmpeg = runFFmpeg;
exports.runPipe = runPipe;
exports.ok = ok;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const LOG_FILE = "comandi.txt";
function runFFmpeg(args, label = "FFmpeg") {
    const cmd = `ffmpeg ${args.join(" ")}`;
    console.log(`[${label}] ${cmd}`);
    // Salva anche su file
    (0, fs_1.appendFileSync)(LOG_FILE, `[${label}] ${cmd}\n`);
    const res = (0, child_process_1.spawnSync)("ffmpeg", args, { stdio: "inherit" });
    if (res.status !== 0)
        throw new Error(`${label} failed (exit ${res.status ?? "unknown"})`);
}
function runPipe(cmd, args, label) {
    const fullCmd = `${cmd} ${args.join(" ")}`;
    console.log(`[${label}] ${fullCmd}`);
    // Salva anche su file
    (0, fs_1.appendFileSync)(LOG_FILE, `[${label}] ${fullCmd}\n`);
    return (0, child_process_1.spawnSync)(cmd, args, { stdio: "pipe", encoding: "utf-8" });
}
function ok(res) {
    return (res.status ?? 1) === 0;
}
