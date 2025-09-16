import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "zlib";
import { paths } from "./paths";
import { loadModifications, loadTemplate, TemplateElement } from "./template";
import { fontFamilyToFileBase, parseFontWeight } from "./fonts";

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

type HttpGetOptions = {
  headers?: Record<string, string>;
};

type HttpHeaders = Record<string, string | string[] | undefined>;

type HttpResponse = {
  buffer: Buffer;
  headers: HttpHeaders;
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
        if (status !== 200) {
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ buffer: Buffer.concat(chunks), headers: res.headers }));
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

async function downloadFile(url: string, outPath: string, options?: HttpGetOptions) {
  const { buffer } = await httpGet(url, options);
  ensureDir(join(outPath, ".."));
  writeFileSync(outPath, buffer);
  console.log(`Scaricato: ${outPath}`);
}

export async function fetchAssets() {
  const mods = loadModifications() || {};

  // Pulisce completamente la cartella di download per evitare artefatti (es. "npm" o "img=true")
  clearDir(paths.downloads);

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
  const fontRequests = new Map<string, { includeDefault: boolean; weights: Set<number> }>();
  function registerFont(family: string, weightValue: unknown) {
    const fam = family.trim();
    if (!fam) return;
    const info = fontRequests.get(fam) ?? { includeDefault: false, weights: new Set<number>() };
    const parsedWeight = parseFontWeight(weightValue);
    if (parsedWeight != null) info.weights.add(parsedWeight);
    else info.includeDefault = true;
    fontRequests.set(fam, info);
  }
  function collectFonts(el: TemplateElement) {
    const fam = (el as any).font_family;
    const weight = (el as any).font_weight;
    if (typeof fam === "string" && fam.trim()) registerFont(fam, weight);
    if (Array.isArray(el.elements)) {
      for (const child of el.elements) collectFonts(child);
    }
  }
  tpl.elements.forEach((e) => collectFonts(e));

  type FontFaceDescriptor = {
    url: string;
    weightMin?: number;
    weightMax?: number;
    style?: string;
  };

  function parseFontFaces(css: string): FontFaceDescriptor[] {
    const faces: FontFaceDescriptor[] = [];
    const faceRe = /@font-face\s*{[^}]*}/gi;
    let match: RegExpExecArray | null;
    while ((match = faceRe.exec(css))) {
      const block = match[0];
      const urlMatch = block.match(/url\(([^)]+)\)/i);
      if (!urlMatch) continue;
      let url = urlMatch[1].trim();
      if ((url.startsWith("\"") && url.endsWith("\"")) || (url.startsWith("'") && url.endsWith("'"))) {
        url = url.slice(1, -1);
      }
      const weightMatch = block.match(/font-weight:\s*([^;]+);/i);
      let weightMin: number | undefined;
      let weightMax: number | undefined;
      if (weightMatch) {
        const raw = weightMatch[1].trim();
        const parts = raw.split(/\s+/);
        if (parts.length === 1) {
          const n = parseFloat(parts[0]);
          if (Number.isFinite(n)) {
            const rounded = Math.round(n);
            weightMin = rounded;
            weightMax = rounded;
          }
        } else if (parts.length >= 2) {
          const n1 = parseFloat(parts[0]);
          const n2 = parseFloat(parts[1]);
          if (Number.isFinite(n1) && Number.isFinite(n2)) {
            weightMin = Math.round(Math.min(n1, n2));
            weightMax = Math.round(Math.max(n1, n2));
          }
        }
      }
      const styleMatch = block.match(/font-style:\s*([^;]+);/i);
      const style = styleMatch ? styleMatch[1].trim().toLowerCase() : undefined;
      faces.push({ url, weightMin, weightMax, style });
    }
    return faces;
  }

  function compareFaces(a: FontFaceDescriptor, b: FontFaceDescriptor): number {
    const styleA = (a.style ?? "normal") === "normal" ? 0 : 1;
    const styleB = (b.style ?? "normal") === "normal" ? 0 : 1;
    if (styleA !== styleB) return styleA - styleB;
    const weightA =
      typeof a.weightMax === "number"
        ? a.weightMax
        : typeof a.weightMin === "number"
        ? a.weightMin
        : 0;
    const weightB =
      typeof b.weightMax === "number"
        ? b.weightMax
        : typeof b.weightMin === "number"
        ? b.weightMin
        : 0;
    return weightB - weightA;
  }

  function selectFontFace(css: string, targetWeight?: number): FontFaceDescriptor | undefined {
    const faces = parseFontFaces(css);
    if (!faces.length) return undefined;
    if (typeof targetWeight === "number") {
      const matches = faces.filter((face) => {
        if (typeof face.weightMin === "number" && typeof face.weightMax === "number") {
          return targetWeight >= face.weightMin && targetWeight <= face.weightMax;
        }
        if (typeof face.weightMin === "number") return targetWeight === face.weightMin;
        if (typeof face.weightMax === "number") return targetWeight === face.weightMax;
        return false;
      });
      if (matches.length) {
        return [...matches].sort(compareFaces)[0];
      }
    }
    return [...faces].sort(compareFaces)[0];
  }

  function buildFamilyQuery(family: string, weight?: number): string {
    let param = family.trim().replace(/\s+/g, "+");
    if (typeof weight === "number") {
      param += `:wght@${weight}`;
    }
    return encodeURIComponent(param)
      .replace(/%3A/g, ":")
      .replace(/%40/g, "@")
      .replace(/%2B/g, "+");
  }

  async function downloadFont(family: string, weight?: number) {
    const query = buildFamilyQuery(family, weight);
    try {
      const cssRes = await httpGet(
        `https://fonts.googleapis.com/css2?family=${query}`,
        {
          headers: {
            Accept: "text/css,*/*;q=0.1",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "identity",
          },
        }
      );
      const css = decodeTextResponse(cssRes);
      const face = selectFontFace(css, weight);
      if (!face) return;
      const fontUrl = face.url.startsWith("http")
        ? face.url
        : `https://fonts.gstatic.com/${face.url.replace(/^\//, "")}`;
      const urlObj = (() => {
        try {
          return new URL(fontUrl);
        } catch {
          return undefined;
        }
      })();
      const ext = urlObj?.pathname.split(".").pop()?.split("?")[0] || "ttf";
      const safeExt = ext.length <= 5 ? ext : "ttf";
      const safe = fontFamilyToFileBase(family);
      const suffix = typeof weight === "number" ? `-w${weight}` : "";
      const fileName = safe
        ? `${safe}${suffix}.${safeExt}`
        : `${encodeURIComponent(family)}${suffix}.${safeExt}`;
      await downloadFile(fontUrl, join(paths.fonts, fileName));
    } catch (err) {
      console.warn(`Impossibile scaricare il font ${family}:`, err);
    }
  }

  for (const [fam, info] of fontRequests) {
    if (info.includeDefault || info.weights.size === 0) {
      await downloadFont(fam);
    }
    for (const w of info.weights) {
      await downloadFont(fam, w);
    }
  }

  console.log("✅ Tutti gli asset sono stati scaricati.");
}
