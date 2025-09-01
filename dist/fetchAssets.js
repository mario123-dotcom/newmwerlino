"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAssets = fetchAssets;
const fs_1 = require("fs");
const path_1 = require("path");
const node_fetch_1 = __importDefault(require("node-fetch")); // npm install node-fetch
const paths_1 = require("./paths");
const template_1 = require("./template");
function ensureDir(dir) {
    if (!(0, fs_1.existsSync)(dir))
        (0, fs_1.mkdirSync)(dir, { recursive: true });
}
// Cancella tutto il contenuto di una cartella
function clearDir(dir) {
    if (!(0, fs_1.existsSync)(dir))
        return;
    for (const file of (0, fs_1.readdirSync)(dir)) {
        (0, fs_1.rmSync)((0, path_1.join)(dir, file), { recursive: true, force: true });
    }
}
async function downloadFile(url, outPath) {
    const res = await (0, node_fetch_1.default)(url);
    if (!res.ok)
        throw new Error(`Errore download ${url} -> ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    ensureDir((0, path_1.join)(outPath, ".."));
    (0, fs_1.writeFileSync)(outPath, buf);
    console.log(`Scaricato: ${outPath}`);
}
async function fetchAssets() {
    const data = (0, template_1.loadTemplate)();
    const mods = data.modifications || {};
    // pulizia delle sottocartelle
    clearDir(paths_1.paths.audio);
    clearDir(paths_1.paths.images);
    clearDir(paths_1.paths.tts);
    // ricrea cartelle
    ensureDir(paths_1.paths.audio);
    ensureDir(paths_1.paths.images);
    ensureDir(paths_1.paths.tts);
    // Logo
    const logoUrl = String(mods.Logo ?? "");
    if (logoUrl.startsWith("http")) {
        await downloadFile(logoUrl, (0, path_1.join)(paths_1.paths.images, "logo.png"));
    }
    // Audio
    const audioUrl = String(mods.Audio ?? "");
    if (audioUrl.startsWith("http")) {
        await downloadFile(audioUrl, (0, path_1.join)(paths_1.paths.audio, "bg.mp3"));
    }
    // TTS
    for (const key of Object.keys(mods)) {
        if (key.startsWith("TTS-")) {
            const url = String(mods[key] ?? "");
            if (url.startsWith("http")) {
                const idx = key.split("-")[1];
                await downloadFile(url, (0, path_1.join)(paths_1.paths.tts, `tts-${idx}.mp3`));
            }
        }
    }
    // Immagini
    for (const key of Object.keys(mods)) {
        if (key.startsWith("Immagine-")) {
            const url = String(mods[key] ?? "");
            if (url.startsWith("http")) {
                const idx = key.split("-")[1];
                const ext = url.split(".").pop()?.split("?")[0] || "jpg";
                await downloadFile(url, (0, path_1.join)(paths_1.paths.images, `img${idx}.${ext}`));
            }
        }
    }
    console.log("✅ Tutti gli asset sono stati scaricati.");
}
