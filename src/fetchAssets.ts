import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import fetch from "node-fetch"; // npm install node-fetch
import { paths } from "./paths";
import { loadTemplate } from "./template";
import { loadSlideLayouts } from "./templateLayout";

/** Assicura l'esistenza di una directory creando eventuali cartelle mancanti. */
function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Cancella ricorsivamente il contenuto di una cartella. */
/** Scarica un file da `url` e lo salva in `outPath`. */
async function downloadFile(url: string, outPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Errore download ${url} -> ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  ensureDir(join(outPath, ".."));
  writeFileSync(outPath, buf);
  console.log(`Scaricato: ${outPath}`);
}

/**
 * Scarica tutti gli asset remoti (immagini, audio, TTS, logo) definiti nel
 * template JSON e li organizza nella cartella `download/` pronta per il
 * rendering.
 */
export async function fetchAssets(): Promise<Record<string, string>> {
  const data = loadTemplate();
  const mods = data.modifications || {};

  // assicura l'esistenza delle cartelle ma non cancella asset esistenti
  ensureDir(paths.audio);
  ensureDir(paths.images);
  ensureDir(paths.tts);
  ensureDir(paths.fonts);

  // helper per scaricare un asset senza interrompere il flusso
  async function safeDownload(url: string, outPath: string) {
    try {
      await downloadFile(url, outPath);
    } catch (err: any) {
      console.warn(`Impossibile scaricare ${url}: ${err.message}`);
    }
  }

  // Logo
  const logoUrl = String(mods.Logo ?? "");
  const logoPath = join(paths.images, "logo.png");
  try { unlinkSync(logoPath); } catch {}
  if (logoUrl.startsWith("http")) {
    await safeDownload(logoUrl, logoPath);
  }

  // Audio
  const audioUrl = String(mods.Audio ?? "");
  const audioPath = join(paths.audio, "bg.mp3");
  try { unlinkSync(audioPath); } catch {}
  if (audioUrl.startsWith("http")) {
    await safeDownload(audioUrl, audioPath);
  }

  // TTS
  for (const key of Object.keys(mods)) {
    if (key.startsWith("TTS-")) {
      const url = String(mods[key] ?? "");
      if (url.startsWith("http")) {
        const idx = key.split("-")[1];
        const out = join(paths.tts, `tts-${idx}.mp3`);
        try { unlinkSync(out); } catch {}
        await safeDownload(url, out);
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
        const out = join(paths.images, `img${idx}.${ext}`);
        try { unlinkSync(out); } catch {}
        await safeDownload(url, out);
      }
    }
  }

  // Font
  const layouts = loadSlideLayouts();
  const families = new Set<string>();
  Object.values(layouts).forEach((els) => {
    els.forEach((el) => {
      if (el.type === "text" && el.font_family) families.add(el.font_family);
    });
  });

  const fontMap: Record<string, string> = {};
  for (const fam of families) {
    const dir = fam.toLowerCase().replace(/\s+/g, "");
    const metaUrl = `https://raw.githubusercontent.com/google/fonts/main/ofl/${dir}/METADATA.pb`;
    try {
      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) throw new Error(metaRes.statusText);
      const meta = await metaRes.text();
      const m = meta.match(/filename: \"([^\"]+)\"/);
      if (!m) throw new Error("filename non trovato");
      const filename = m[1];
      const fontUrl = `https://raw.githubusercontent.com/google/fonts/main/ofl/${dir}/${filename}`;
      const outPath = join(paths.fonts, filename);
      await safeDownload(fontUrl, outPath);
      fontMap[fam] = outPath;
    } catch (err: any) {
      console.warn(`Font ${fam} non scaricato: ${err.message}`);
      const existing = readdirSync(paths.fonts).find((f) =>
        f.toLowerCase().includes(dir)
      );
      if (existing) fontMap[fam] = join(paths.fonts, existing);
    }
  }

  console.log("✅ Tutti gli asset sono stati scaricati.");
  return fontMap;
}
