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
function clearDir(dir: string) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    rmSync(join(dir, file), { recursive: true, force: true });
  }
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

const BASE_NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function createNoCacheHeaders(attempt: number) {
  const uniqueSuffix = `${attempt}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    ...BASE_NO_CACHE_HEADERS,
    "If-Modified-Since": "Thu, 01 Jan 1970 00:00:00 GMT",
    "If-None-Match": `"force-refresh-${uniqueSuffix}"`,
  } satisfies Record<string, string>;
}

type HttpGetOptions = {
  headers?: Record<string, string>;
};

type HttpHeaders = Record<string, string | string[] | undefined>;

type HttpResponse = {
  buffer: Buffer;
  headers: HttpHeaders;
};

type HttpError = Error & {
  status?: number;
  url?: string;
  attempt?: number;
};

const MAX_304_RETRIES = 4;

function createHttpError(status: number, url: string, attempt: number): HttpError {
  const error = new Error(`HTTP ${status}`) as HttpError;
  error.status = status;
  error.url = url;
  error.attempt = attempt;
  return error;
}

function httpGet(url: string, options: HttpGetOptions = {}): Promise<HttpResponse> {
  const baseHeaders = { ...DEFAULT_HEADERS, ...options.headers };

  const performRequest = (currentUrl: string, attempt: number): Promise<HttpResponse> => {
    const target = new URL(currentUrl);
    const lib = target.protocol === "https:" ? httpsRequest : httpRequest;
    const headers =
      attempt > 0
        ? { ...baseHeaders, ...createNoCacheHeaders(attempt) }
        : { ...baseHeaders };

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
            performRequest(next, attempt).then(resolve, reject);
            return;
          }
          if (status === 304) {
            if (attempt < MAX_304_RETRIES) {
              const cacheBusted = new URL(currentUrl);
              cacheBusted.searchParams.set(
                "_cb",
                `${Date.now()}-${attempt}-${Math.random().toString(36).slice(2)}`
              );
              performRequest(cacheBusted.toString(), attempt + 1).then(resolve, reject);
              return;
            }
            reject(createHttpError(status, currentUrl, attempt));
            return;
          }
          if (status !== 200) {
            reject(createHttpError(status, currentUrl, attempt));
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve({ buffer: Buffer.concat(chunks), headers: res.headers }));
        }
      );
      req.on("error", (err) => {
        const error = err as HttpError;
        error.url = currentUrl;
        error.attempt = attempt;
        reject(error);
      });
      req.end();
    });
  };

  return performRequest(url, 0);
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

async function fetchWithoutCache(
  url: string,
  options: HttpGetOptions = {},
  attempt = 0
): Promise<Buffer> {
  const headers = {
    ...DEFAULT_HEADERS,
    ...options.headers,
    ...createNoCacheHeaders(attempt),
  };
  const response = await fetch(url, {
    method: "GET",
    headers,
    redirect: "follow",
    cache: "no-store",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      const nextUrl = new URL(location, url).toString();
      return fetchWithoutCache(nextUrl, options);
    }
  }

  if (response.status === 304) {
    if (attempt < 2) {
      const nextUrl = new URL(url);
      nextUrl.searchParams.set(
        "_force",
        `${Date.now()}-${attempt}-${Math.random().toString(36).slice(2)}`
      );
      return fetchWithoutCache(nextUrl.toString(), options, attempt + 1);
    }
    throw createHttpError(response.status, url, attempt);
  }

  if (!response.ok) {
    throw createHttpError(response.status, url, attempt);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function saveFile(outPath: string, buffer: Buffer, messagePrefix = "Scaricato") {
  ensureDir(join(outPath, ".."));
  writeFileSync(outPath, buffer);
  console.log(`${messagePrefix}: ${outPath}`);
}

async function downloadFile(url: string, outPath: string, options?: HttpGetOptions) {
  try {
    const { buffer } = await httpGet(url, options);
    saveFile(outPath, buffer);
    return;
  } catch (err) {
    const httpError = err as HttpError;
    if (httpError?.status === 304) {
      const fallbackUrl = new URL(httpError.url ?? url);
      fallbackUrl.searchParams.set("_cb", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const buffer = await fetchWithoutCache(fallbackUrl.toString(), options);
      saveFile(outPath, buffer, "Scaricato (no-cache)");
      return;
    }
    throw err;
  }
}

export async function fetchAssets() {
  const mods = loadModifications() || {};

  ensureDir(paths.downloads);

  // Pulisce le cartelle dinamiche ma lascia intatta la directory dei font locali
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
