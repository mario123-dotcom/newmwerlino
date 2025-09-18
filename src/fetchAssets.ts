import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "zlib";
import { paths } from "./paths";
import { loadModifications } from "./template";

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

type HttpGetOptions = {
  headers?: Record<string, string>;
};

type HttpHeaders = Record<string, string | string[] | undefined>;

type HttpResponse = {
  buffer: Buffer;
  headers: HttpHeaders;
  statusCode: number;
};

function httpGet(url: string, options: HttpGetOptions = {}): Promise<HttpResponse> {
  const target = new URL(url);
  const lib = target.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = { ...DEFAULT_HEADERS, ...options.headers };
  return new Promise((resolve, reject) => {
    const req = lib(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const loc = res.headers.location;
        if (status >= 300 && status < 400 && loc) {
          const next = new URL(loc, target).toString();
          httpGet(next, options).then(resolve, reject);
          return;
        }
        if (status === 304) {
          resolve({ buffer: Buffer.alloc(0), headers: res.headers, statusCode: status });
          return;
        }
        if (status !== 200) {
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ buffer: Buffer.concat(chunks), headers: res.headers, statusCode: status })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function decodeTextResponse(res: HttpResponse): string {
  const enc = String(res.headers["content-encoding"] || "").toLowerCase();
  try {
    if (enc.includes("br")) {
      return brotliDecompressSync(res.buffer).toString("utf8");
    }
    if (enc.includes("gzip")) {
      return gunzipSync(res.buffer).toString("utf8");
    }
    if (enc.includes("deflate")) {
      return inflateSync(res.buffer).toString("utf8");
    }
  } catch (err) {
    console.warn("Impossibile decodificare la risposta compressa:", err);
  }
  return res.buffer.toString("utf8");
}

type DownloadResult = "downloaded" | "reused";

async function downloadFile(
  url: string,
  outPath: string,
  options?: HttpGetOptions
): Promise<DownloadResult> {
  const res = await httpGet(url, options);
  if (res.statusCode === 304) {
    if (existsSync(outPath)) {
      console.log(`Riutilizzo asset locale (HTTP 304): ${outPath}`);
      return "reused";
    }
    throw new Error(
      `HTTP 304 ricevuto per ${url} ma il file locale ${outPath} non esiste. Elimina la cache o riesegui senza modalità locale.`
    );
  }

  ensureDir(join(outPath, ".."));
  writeFileSync(outPath, res.buffer);
  console.log(`Scaricato: ${outPath}`);
  return "downloaded";
}

function pruneDirExcept(dir: string, keep: Set<string>) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    const abs = join(dir, file);
    if (!keep.has(abs)) {
      rmSync(abs, { recursive: true, force: true });
    }
  }
}

export async function fetchAssets() {
  const mods = loadModifications() || {};

  ensureDir(paths.downloads);

  ensureDir(paths.audio);
  ensureDir(paths.images);
  ensureDir(paths.tts);
  ensureDir(paths.fonts);

  const keepAudio = new Set<string>();
  const keepImages = new Set<string>();
  const keepTts = new Set<string>();

  // Logo
  const logoUrl = String(mods.Logo ?? "");
  if (logoUrl.startsWith("http")) {
    const logoPath = join(paths.images, "logo.png");
    await downloadFile(logoUrl, logoPath);
    keepImages.add(logoPath);
  }

  // Audio di background
  const audioUrl = String(mods.Audio ?? "");
  if (audioUrl.startsWith("http")) {
    const audioPath = join(paths.audio, "bg.mp3");
    await downloadFile(audioUrl, audioPath);
    keepAudio.add(audioPath);
  }

  // TTS
  for (const key of Object.keys(mods)) {
    const m = key.match(/^TTS-(\d+)$/);
    if (m) {
      const url = String(mods[key] ?? "").trim();
      if (url.startsWith("http")) {
        const ttsPath = join(paths.tts, `tts-${m[1]}.mp3`);
        await downloadFile(url, ttsPath);
        keepTts.add(ttsPath);
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
        const imagePath = join(paths.images, `img${m[1]}.${safeExt}`);
        await downloadFile(url, imagePath);
        keepImages.add(imagePath);
      }
    }
  }

  pruneDirExcept(paths.audio, keepAudio);
  pruneDirExcept(paths.images, keepImages);
  pruneDirExcept(paths.tts, keepTts);

  console.log("✅ Tutti gli asset sono stati scaricati.");
}
