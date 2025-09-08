// src/types.ts

// ————————————————————————————————————————————————
// Tipi di base letti dal file risposta_*.json
// ————————————————————————————————————————————————
export interface Modifications {
  [key: string]: any; // string | number | boolean | ...
}

export interface FullData {
  modifications: Modifications;
  width: number;
  height: number;
  frame_rate: number;
  duration: number;
  output_format?: string;
  fill_color?: string;
}

// ————————————————————————————————————————————————
// Tipi legacy usati da cli.ts / filters.ts / renderers/image.ts
// (li ripristiniamo per compatibilità)
// ————————————————————————————————————————————————
export type TextTransition =
  | "wipeup"
  | "wipedown"
  | "wipeleft"
  | "wiperight";

export type LogoPosition = "bottom" | "top-left";

// I vecchi segmenti “classici”
export type LegacySegKind = "image" | "filler" | "outro";

export interface SegmentLegacy {
  kind: LegacySegKind;
  index?: number;
  start: number;
  duration: number;
  text?: string;
  tts?: string | null;
  img?: string | null;
}

// Mantieni anche l’alias storico se da qualche parte viene importato
export type SegType = LegacySegKind;

// ————————————————————————————————————————————————
// Nuova variante: segmenti “composition” (template JSON)
// ————————————————————————————————————————————————
export interface SegmentComposition {
  kind: "composition";
  name: string;     // es. "Slide_0"
  start: number;    // in secondi
  duration: number; // in secondi
  index?: number;
}

// Unione complessiva usata dal nuovo main/timeline
export type Segment = SegmentLegacy | SegmentComposition;

// (opzionale, se ti serve altrove)
// export type SegTypeExtended = LegacySegKind | "composition";
