import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync, statSync } from "fs";
import { join } from "path";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "zlib";
import { paths } from "./paths";
import { loadModifications } from "./template";

/**
 * Crea la directory indicata (e gli eventuali antenati) se non esiste già.
 *
 * @param dir Percorso assoluto della cartella da garantire.
 */
function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
/**
 * Elimina tutti i file e le cartelle contenuti nel percorso indicato.
 *
 * @param dir Cartella di cui svuotare il contenuto. Se non esiste non fa nulla.
 */
function clearDir(dir: string) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    rmSync(join(dir, file), { recursive: true, force: true });
  }
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  // Richiede risposte non compresse per salvare i file così come forniti.
  "Accept-Encoding": "identity",
  // Header Accept allineato a quello di un browser per asset grafici.
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

/**
 * Decompressione opportunistica di una risposta HTTP in base all'header
 * `Content-Encoding`.
 *
 * @param buffer Il payload raw ricevuto via HTTP.
 * @param headers Gli header della risposta utilizzati per determinare l'algoritmo.
 * @returns Il buffer originale oppure il risultato della decompressione.
 */
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

/**
 * Esegue una richiesta HTTP/HTTPS con redirect automatici e headers da browser.
 *
 * @param url Risorsa remota da recuperare.
 * @param options Opzioni opzionali, in particolare headers aggiuntivi.
 * @returns Una Promise che risolve con buffer, headers, status e URL finale.
 */
function httpGet(url: string, options: HttpGetOptions = {}): Promise<HttpResponse> {
  const target = new URL(url);
  const lib = target.protocol === "https:" ? httpsRequest : httpRequest;

  // Alcuni CDN richiedono un header Referer coerente con il dominio di origine.
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

        // Gestione esplicita dei redirect HTTP 3xx.
        if (status >= 300 && status < 400 && loc) {
          const next = new URL(loc, target).toString();
          httpGet(next, options).then(resolve, reject);
          return;
        }

        // Le risposte 304 indicano che la risorsa non è cambiata.
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

/**
 * Applica un parametro query `cb=<timestamp>` per forzare l'invalidazione cache.
 *
 * @param url URL originale.
 * @returns L'URL con parametro di cache busting aggiuntivo.
 */
function withCacheBuster(url: string): string {
  const u = new URL(url);
  u.searchParams.set("cb", Date.now().toString());
  return u.toString();
}

/**
 * Scarica un file remoto gestendo richieste condizionali e decompressione.
 *
 * @param url Percorso assoluto dell'asset da scaricare.
 * @param outPath Destinazione locale sul filesystem.
 * @param options Headers opzionali e impostazioni aggiuntive.
 */
async function downloadFile(url: string, outPath: string, options?: HttpGetOptions) {
  const hdrs = { ...(options?.headers || {}) };

  // Se il file esiste si effettua una richiesta condizionata con If-Modified-Since.
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

  // Decompressione manuale nel caso il server ignori l'header Accept-Encoding.
  let data = decompressIfNeeded(res.buffer, res.headers);

  // Verifica che il content-type restituito corrisponda a un asset grafico.
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

/**
 * Scarica tutti gli asset necessari (logo, immagini, TTS, musica, font)
 * basandosi sulle modifiche fornite dal backend e pulendo le cartelle di
 * lavoro prima del nuovo fetch.
 *
 * @returns Una Promise risolta quando tutti i download sono completati.
 */
export async function fetchAssets() {
  const mods = loadModifications() || {};

  ensureDir(paths.downloads);

  // Pulisce le cartelle di lavoro prima di scaricare i nuovi asset.
  ensureDir(paths.audio);
  clearDir(paths.audio);
  ensureDir(paths.images);
  clearDir(paths.images);
  ensureDir(paths.tts);
  clearDir(paths.tts);
  ensureDir(paths.fonts);

  // Scarica il logo aziendale se fornito dal payload delle modifications.
  const logoUrl = String(mods.Logo ?? "");
  if (logoUrl.startsWith("http")) {
    await downloadFile(logoUrl, join(paths.images, "logo.png"));
  }

  // Recupera la traccia di sottofondo opzionale.
  const audioUrl = String(mods.Audio ?? "");
  if (audioUrl.startsWith("http")) {
    await downloadFile(audioUrl, join(paths.audio, "bg.mp3"));
  }

  // Scarica tutte le clip TTS referenziate dalle modifiche.
  for (const key of Object.keys(mods)) {
    const m = key.match(/^TTS-(\d+)$/);
    if (m) {
      const url = String(mods[key] ?? "").trim();
      if (url.startsWith("http")) {
        await downloadFile(url, join(paths.tts, `tts-${m[1]}.mp3`));
      }
    }
  }

  // Scarica le immagini abbinate a ciascuna slide.
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
