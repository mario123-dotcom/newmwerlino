import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { paths } from "./paths";
import { loadModifications } from "./template";

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
function clearDir(dir: string) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    rmSync(join(dir, file), { recursive: true, force: true });
  }
}

function httpGet(url: string): Promise<Buffer> {
  const lib = url.startsWith("https") ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = lib(url, (res) => {
      const status = res.statusCode ?? 0;
      const loc = res.headers.location;
      if (status >= 300 && status < 400 && loc) {
        httpGet(loc).then(resolve, reject);
        return;
      }
      if (status !== 200) {
        reject(new Error(`HTTP ${status}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.end();
  });
}

async function downloadFile(url: string, outPath: string) {
  const buf = await httpGet(url);
  ensureDir(join(outPath, ".."));
  writeFileSync(outPath, buf);
  console.log(`Scaricato: ${outPath}`);
}

export async function fetchAssets() {
  const mods = loadModifications() || {};

  clearDir(paths.audio);
  clearDir(paths.images);
  clearDir(paths.tts);

  ensureDir(paths.audio);
  ensureDir(paths.images);
  ensureDir(paths.tts);

  // Logo
  const logoUrl = String(mods.Logo ?? "");
  if (logoUrl.startsWith("http")) {
    await downloadFile(logoUrl, join(paths.images, "logo.png"));
  }

  // Audio di background
  const audioUrl = String(mods.Audio ?? "");
  if (audioUrl.startsWith("http")) {
    await downloadFile(audioUrl, join(paths.audio, "bg.mp3"));
  }

  // TTS
  for (const key of Object.keys(mods)) {
    if (key.startsWith("TTS-")) {
      const url = String(mods[key] ?? "");
      if (url.startsWith("http")) {
        const idx = key.split("-")[1];
        await downloadFile(url, join(paths.tts, `tts-${idx}.mp3`));
      }
    }
  }

  // Immagini
  for (const key of Object.keys(mods)) {
    if (key.startsWith("Immagine-")) {
      const url = String(mods[key] ?? "");
      if (url.startsWith("http")) {
        const idx = key.split("-")[1];
        const ext = (url.split(".").pop()?.split("?")[0] || "jpg").toLowerCase();
        const safeExt = ext.length <= 5 ? ext : "jpg";
        await downloadFile(url, join(paths.images, `img${idx}.${safeExt}`));
      }
    }
  }

  console.log("✅ Tutti gli asset sono stati scaricati.");
}
