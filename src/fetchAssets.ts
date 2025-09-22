import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync, statSync } from "fs";
import { join } from "path";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "zlib";
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

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  // chiedi esplicitamente di NON comprimere la risposta
  "Accept-Encoding": "identity",
  // accetta immagini come farebbe un browser
  "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

type HttpGetOptions = {
  headers?: Record<string, string>;
};

type HttpHeaders = Record<string, string | string[] | undefined>;

type HttpResponse = {
  buffer: Buffer;
  headers: HttpHeaders;
  statusCode: number;
  finalUrl: string;
};

function decompressIfNeeded(buffer: Buffer, headers: HttpHeaders): Buffer {
  const enc = String(headers["content-encoding"] || "").toLowerCase();
  try {
    if (enc.includes("br")) return brotliDecompressSync(buffer);
    if (enc.includes("gzip")) return gunzipSync(buffer);
    if (enc.includes("deflate")) return inflateSync(buffer);
  } catch (err) {
    console.warn("Impossibile decodificare la risposta compressa:", err);
  }
  return buffer;
}

function httpGet(url: string, options: HttpGetOptions = {}): Promise<HttpResponse> {
  const target = new URL(url);
  const lib = target.protocol === "https:" ? httpsRequest : httpRequest;

  // alcuni server vogliono un Referer “sensato”
  const headers = {
    ...DEFAULT_HEADERS,
    Referer: `${target.protocol}//${target.hostname}/`,
    "Cache-Control": "no-cache",
    ...options.headers,
  };

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

        // Redirect
        if (status >= 300 && status < 400 && loc) {
          const next = new URL(loc, target).toString();
          httpGet(next, options).then(resolve, reject);
          return;
        }

        // 304 → non errore
        if (status === 304) {
          resolve({
            buffer: Buffer.alloc(0),
            headers: res.headers,
            statusCode: status,
            finalUrl: target.toString(),
          });
          return;
        }

        if (status !== 200) {
          reject(new Error(`HTTP ${status} ${target.toString()}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            buffer: Buffer.concat(chunks),
            headers: res.headers,
            statusCode: status,
            finalUrl: target.toString(),
          })
        );
      }
    );

    req.on("error", reject);
    req.end();
  });
}

function withCacheBuster(url: string): string {
  const u = new URL(url);
  u.searchParams.set("cb", Date.now().toString());
  return u.toString();
}

async function downloadFile(url: string, outPath: string, options?: HttpGetOptions) {
  const hdrs = { ...(options?.headers || {}) };

  // Se esiste già il file, prova richiesta condizionata
  if (existsSync(outPath)) {
    const mtime = statSync(outPath).mtime.toUTCString();
    hdrs["If-Modified-Since"] = mtime;
  }

  let res = await httpGet(url, { ...options, headers: hdrs });

  if (res.statusCode === 304 && existsSync(outPath)) {
    console.log(`Non modificato (304): ${outPath}`);
    return;
  }

  if (res.statusCode === 304 && !existsSync(outPath)) {
    console.log(`Cache vuota per ${outPath}, riscarico...`);
    res = await httpGet(withCacheBuster(url), options);
  }

  // Se per qualche motivo il server ha compresso comunque, decomprimi
  let data = decompressIfNeeded(res.buffer, res.headers);

  // Sanity check: il server ci sta davvero dando un’immagine?
  const ctype = String(res.headers["content-type"] || "").toLowerCase();
  if (ctype && !ctype.startsWith("image/")) {
    console.warn(
      `[ATTENZIONE] Content-Type non immagine (${ctype}) per ${res.finalUrl}. ` +
      `Potrebbe essere una pagina HTML di errore salvata come file immagine.`
    );
  }

  ensureDir(join(outPath, ".."));
  writeFileSync(outPath, data);
  console.log(`Scaricato: ${outPath}`);
}

export async function fetchAssets() {
  const mods = loadModifications() || {};

  ensureDir(paths.downloads);

  // reset cartelle dinamiche
  ensureDir(paths.audio);
  clearDir(paths.audio);
  ensureDir(paths.images);
  clearDir(paths.images);
  ensureDir(paths.tts);
  clearDir(paths.tts);
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

  console.log("✅ Tutti gli asset sono stati scaricati.");
}

export function useLocalAssets() {
  ensureDir(paths.downloads);
  ensureDir(paths.audio);
  ensureDir(paths.images);
  ensureDir(paths.tts);
  ensureDir(paths.fonts);
  console.log("⚠️ Modalità locale attiva: utilizzo degli asset già presenti in download.");
}
