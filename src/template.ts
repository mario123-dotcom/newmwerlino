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

/**
 * Definizione tipizzata di un elemento Creatomate con gli attributi
 * utilizzati dai builder per recuperare geometrie, testi e animazioni.
 */
export type TemplateElement = {
  name?: string;
  type: string;              // Tipologia dell'elemento (composition, text, image, shape, audio).
  time?: number;             // Istante di inizio in secondi se definito.
  duration?: number;         // Durata in secondi ricavata dal template.
  visible?: boolean;

  // Coordinate e dimensioni possono essere espresse come numeri o percentuali.
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  x_anchor?: number | string;
  y_anchor?: number | string;

  // Proprietà specifiche per i layer di testo.
  text?: string;
  font_size?: number | string;
  font_family?: string;
  font_weight?: string;
  line_height?: number | string;
  color?: string;
  background_color?: string;

  // Attributi condivisi da immagini e forme vettoriali.
  fill_color?: string;
  opacity?: number;

  // Sotto-elementi annidati all'interno della composition corrente.
  elements?: TemplateElement[];

  // Campi opzionali di tagging utilizzati per ricerche semantiche.
  tags?: string | string[];
  tag?: string | string[];

  // Definizioni di animazioni esportate dal template.
  animations?: {
    time?: number | string;
    duration?: number | string;
    type: string;
    reversed?: boolean;
    [key: string]: any;
  }[];
};

/**
 * Struttura del documento JSON esportato dal generatore (es. template_horizontal.json).
 */
export type TemplateDoc = {
  width: number;
  height: number;
  frame_rate?: number;
  duration?: number;
  elements: TemplateElement[];
  // Alcune esportazioni incorporano direttamente la sezione "modifications".
  modifications?: Record<string, any>;
};

/**
 * Legge il file di template principale e valida la presenza dell'elenco elementi.
 */
export function loadTemplate(): TemplateDoc {
  // Legge il file template dalla cartella dedicata del progetto.
  const raw = readFileSync(paths.template, "utf8");
  const json = JSON.parse(raw);
  // Validazione minima della struttura del JSON.
  if (!json || typeof json !== "object" || !Array.isArray(json.elements)) {
    throw new Error("template_horizontal.json non valido: manca 'elements'");
  }
  return json as TemplateDoc;
}

/**
 * Carica le modifiche richieste dal backend, accettando sia file dedicati sia
 * template che includono direttamente la sezione "modifications".
 */
export function loadModifications(): Record<string, any> {
  // Prima tenta di leggere il file di risposta separato nella cartella template.
  const rp = paths.modifications;
  if (existsSync(rp)) {
    const raw = readFileSync(rp, "utf8");
    const json = JSON.parse(raw);
    // Il payload può essere già la sezione "modifications" oppure l'intera risposta.
    if (json && typeof json === "object") {
      if (json.modifications && typeof json.modifications === "object") {
        return json.modifications;
      }
      return json;
    }
  }
  // Come fallback si legge la sezione incorporata nel template principale.
  const t = loadTemplate();
  return (t as any).modifications || {};
}

/**
 * Restituisce una composition identificata dal nome (es. Slide_0, Intro, Outro).
 */
export function findComposition(tpl: TemplateDoc, name: string): TemplateElement | undefined {
  return findInElements(tpl.elements, (e) => e.type === "composition" && e.name === name);
}

/**
 * Cerca ricorsivamente un elemento figlio con il nome indicato all'interno di una composition.
 */
export function findChildByName(
  parent: TemplateElement | undefined,
  name: string
): TemplateElement | undefined {
  if (!parent) return undefined;
  return findInElements(parent.elements, (e) => e.name === name);
}

/**
 * Converte valori percentuali o stringhe compatibili in pixel rispetto a una base.
 */
export function pctToPx(val: number | string | undefined, base: number): number | undefined {
  if (val == null) return undefined;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s.endsWith("%")) {
    const n = parseFloat(s.slice(0, -1));
    if (!Number.isFinite(n)) return undefined;
    return (n / 100) * base;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Seleziona un font di sistema disponibile sulla piattaforma corrente da usare
 * quando il template non specifica una famiglia scaricata.
 */
export function getDefaultFontPath(): string {
  // Percorsi noti sui sistemi principali: Windows e distribuzioni Linux.
  const w = "C:\\Windows\\Fonts\\arial.ttf";
  const l1 = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  const l2 = "/usr/share/fonts/truetype/freefont/FreeSans.ttf";
  try { if (existsSync(w)) return w; } catch {}
  try { if (existsSync(l1)) return l1; } catch {}
  return l2;
}
