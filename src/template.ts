import { readFileSync, existsSync } from "fs";
import { paths } from "./paths";

function findInElements(
  elements: TemplateElement[] | undefined,
  predicate: (el: TemplateElement) => boolean
): TemplateElement | undefined {
  if (!Array.isArray(elements)) return undefined;
  for (const el of elements) {
    if (predicate(el)) return el;
    const nested = findInElements(el.elements, predicate);
    if (nested) return nested;
  }
  return undefined;
}

/** Elemento generico del template Creatomate */
export type TemplateElement = {
  name?: string;
  type: string;              // es: 'composition', 'text', 'image', 'shape', 'audio'
  time?: number;             // start in secondi (quando presente)
  duration?: number;         // durata in secondi (quando presente)
  visible?: boolean;

  // geometria: possono essere numeri o stringhe tipo "54.2%"
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  x_anchor?: number | string;
  y_anchor?: number | string;

  // testo (quando type === 'text')
  text?: string;
  font_size?: number | string;
  font_family?: string;
  font_weight?: string;
  line_height?: number | string;
  color?: string;
  background_color?: string;

  // immagine / shape
  fill_color?: string;
  opacity?: number;

  // figli (quando type === 'composition' o gruppi con layers)
  elements?: TemplateElement[];

  // metadati opzionali
  tags?: string | string[];
  tag?: string | string[];

  // animazioni opzionali (es. fade, text-reveal...)
  animations?: {
    time?: number | string;
    duration?: number | string;
    type: string;
    reversed?: boolean;
    [key: string]: any;
  }[];
};

/** Documento template (come template_horizontal.json) */
export type TemplateDoc = {
  width: number;
  height: number;
  frame_rate?: number;
  duration?: number;
  elements: TemplateElement[];
  // Alcuni export Creatomate includono anche "modifications" dentro al template: lo tolleriamo.
  modifications?: Record<string, any>;
};

/** Carica il template JSON (layout/posizioni) */
export function loadTemplate(): TemplateDoc {
  // Percorso standard nella cartella template/
  const raw = readFileSync(paths.template, "utf8");
  const json = JSON.parse(raw);
  // normalizzazione minima
  if (!json || typeof json !== "object" || !Array.isArray(json.elements)) {
    throw new Error("template_horizontal.json non valido: manca 'elements'");
  }
  return json as TemplateDoc;
}

/** Carica le modifications (risposta) da risposta_horizontal.json */
export function loadModifications(): Record<string, any> {
  // Prima prova: file separato risposta_horizontal.json nella cartella template/
  const rp = paths.modifications;
  if (existsSync(rp)) {
    const raw = readFileSync(rp, "utf8");
    const json = JSON.parse(raw);
    // a volte è già un oggetto "modifications", a volte è il payload completo
    if (json && typeof json === "object") {
      if (json.modifications && typeof json.modifications === "object") {
        return json.modifications;
      }
      return json;
    }
  }
  // fallback: alcune esportazioni mettono "modifications" dentro il template
  const t = loadTemplate();
  return (t as any).modifications || {};
}

/** Trova una composition per nome (Slide_0, Slide_1, Intro, Outro, ...) */
export function findComposition(tpl: TemplateDoc, name: string): TemplateElement | undefined {
  return findInElements(tpl.elements, (e) => e.type === "composition" && e.name === name);
}

/** Trova un figlio per nome dentro una composition */
export function findChildByName(
  parent: TemplateElement | undefined,
  name: string
): TemplateElement | undefined {
  if (!parent) return undefined;
  return findInElements(parent.elements, (e) => e.name === name);
}

/** Converte percentuali o stringhe in pixel, altrimenti restituisce numeri come sono. */
export function pctToPx(val: number | string | undefined, base: number): number | undefined {
  if (val == null) return undefined;
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return undefined;
    if (base > 0 && Math.abs(val) > 0 && Math.abs(val) <= 1) {
      return val * base;
    }
    return val;
  }
  const s = String(val).trim();
  if (s.endsWith("%")) {
    const n = parseFloat(s.slice(0, -1));
    if (!Number.isFinite(n)) return undefined;
    return (n / 100) * base;
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return undefined;
  if (base > 0) {
    const abs = Math.abs(n);
    if (abs > 0 && abs <= 1) {
      return n * base;
    }
    if (abs > 1 && abs <= 100 && /^[+-]?\d+(?:\.\d+)?$/.test(s)) {
      return (n / 100) * base;
    }
  }
  return n;
}

/** Piccolo helper per avere un font di fallback cross-platform */
export function getDefaultFontPath(): string {
  // Windows
  const w = "C:\\Windows\\Fonts\\arial.ttf";
  // Linux/WSL
  const l1 = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  const l2 = "/usr/share/fonts/truetype/freefont/FreeSans.ttf";
  try { if (existsSync(w)) return w; } catch {}
  try { if (existsSync(l1)) return l1; } catch {}
  return l2;
}
