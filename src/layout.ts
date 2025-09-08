import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { paths } from "./paths";
import type { Template } from "./types-template";


function looksLikeLayout(json: any): json is Template.Root {
return json && Array.isArray(json.elements) && json.elements.some((e: any) => e?.type === "composition");
}


/** Cerca automaticamente un file di layout nella cartella `template/`. */
export function loadLayout(): Template.Root {
const dir = join(paths.root, "template");
const candidates = readdirSync(dir).filter(f => f.endsWith(".json") && !f.includes("risposta_"));
for (const file of candidates) {
try {
const raw = readFileSync(join(dir, file), "utf-8");
const json = JSON.parse(raw);
if (looksLikeLayout(json)) return json as Template.Root;
} catch { /* ignore */ }
}
throw new Error("Nessun layout JSON trovato in template/. Aggiungi un file compatibile (quello che mi hai allegato va bene).");
}