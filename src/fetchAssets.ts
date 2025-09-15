import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { paths } from "./paths";
import { loadModifications, loadTemplate, TemplateElement } from "./template";

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
  clearDir(paths.fonts);

  ensureDir(paths.audio);
  ensureDir(paths.images);
  ensureDir(paths.tts);
  ensureDir(paths.fonts);

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
    const m = key.match(/^TTS-(\d+)$/);
    if (m) {
      const url = String(mods[key] ?? "").trim();
      if (url.startsWith("http")) {
        await downloadFile(url, join(paths.tts, `tts-${m[1]}.mp3`));
      }
    }
  }

  // Immagini
  for (const key of Object.keys(mods)) {
    const m = key.match(/^Immagine-(\d+)$/);
    if (m) {
      const url = String(mods[key] ?? "").trim();
      if (url.startsWith("http")) {
        const ext = (url.split(".").pop()?.split("?")[0] || "jpg").toLowerCase();
        const safeExt = ext.length <= 5 ? ext : "jpg";
        await downloadFile(url, join(paths.images, `img${m[1]}.${safeExt}`));
      }
    }
  }

  // Font dal template
  const tpl = loadTemplate();
  const fonts = new Set<string>();
  function collectFonts(el: TemplateElement) {
    const fam = (el as any).font_family;
    if (typeof fam === "string" && fam.trim()) fonts.add(fam.trim());
    if (Array.isArray(el.elements)) {
      for (const child of el.elements) collectFonts(child);
    }
  }
  tpl.elements.forEach((e) => collectFonts(e));

  async function downloadFont(family: string) {
    const famParam = family.trim().replace(/\s+/g, "+");
    try {
      const cssBuf = await httpGet(
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(famParam)}`
      );
      const css = cssBuf.toString("utf8");
      const match = css.match(/url\((https:[^\)]+)\)/);
      if (!match) return;
      const fontUrl = match[1];
      const ext = fontUrl.split(".").pop()?.split("?")[0] || "ttf";
      const safe = family.replace(/\s+/g, "_").toLowerCase();
      await downloadFile(fontUrl, join(paths.fonts, `${safe}.${ext}`));
    } catch (err) {
      console.warn(`Impossibile scaricare il font ${family}:`, err);
    }
  }

  for (const fam of fonts) {
    await downloadFont(fam);
  }

  console.log("✅ Tutti gli asset sono stati scaricati.");
}
