import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "../paths";
import { GetLocalAsset } from "../assets";
import type { Modifications } from "../types";

export interface AudioElement {
  type: "audio";
  name?: string;
  source: string;
  volume?: string;
  loop?: boolean;
  audio_fade_in?: number;
  audio_fade_out?: number;
  duration?: number | null;
  time?: number;
}

export interface Animation {
  time?: number;
  duration?: number;
  easing?: string;
  type: string;
  [key: string]: any;
}

export interface BaseVisual {
  type: string;
  name?: string;
  track?: number;
  time?: number;
  duration?: number | null;
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  x_anchor?: string | number;
  y_anchor?: string | number;
  animations?: Animation[];
  [key: string]: any;
}

export interface VideoElement extends BaseVisual {
  type: "video";
  source: string;
}

export interface ImageElement extends BaseVisual {
  type: "image";
  source: string;
  fit?: string;
}

export interface GradientStop {
  offset: string;
  color: string;
}

export interface ShapeElement extends BaseVisual {
  type: "shape";
  path: string;
  fill_color: string | GradientStop[];
  fill_mode?: string;
  fill_x1?: string;
  fill_y1?: string;
}

export interface TextElement extends BaseVisual {
  type: "text";
  text: string;
  font_family?: string;
  font_weight?: string;
  line_height?: string;
  font_size_minimum?: string;
  font_size_maximum?: string;
  fill_color?: string;
  background_color?: string;
  y_alignment?: string;
  y_padding?: string;
  shadow_color?: string;
  shadow_blur?: string;
  shadow_x?: string;
  shadow_y?: string;
}

export type VisualElement = VideoElement | ImageElement | ShapeElement | TextElement;

export interface CompositionElement {
  type: "composition";
  name?: string;
  duration: number;
  fill_color?: string;
  shadow_color?: string;
  shadow_x?: string | number;
  shadow_y?: string | number;
  elements: VisualElement[];
  [key: string]: any;
}

export interface ParsedTemplate {
  audios: AudioElement[];
  compositions: CompositionElement[];
}

function mapAnimations(arr: any[] | undefined): Animation[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  return arr.map((a) => ({ ...a }));
}

function mapVisual(el: any): VisualElement | null {
  const common: BaseVisual = {
    type: el.type,
    name: el.name,
    track: el.track,
    time: el.time,
    duration: el.duration,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    x_anchor: el.x_anchor,
    y_anchor: el.y_anchor,
    animations: mapAnimations(el.animations),
  };
  switch (el.type) {
    case "video":
      return { ...common, type: "video", source: el.source } as VideoElement;
    case "image":
      return { ...common, type: "image", source: el.source, fit: el.fit } as ImageElement;
    case "shape":
      return {
        ...common,
        type: "shape",
        path: el.path,
        fill_color: el.fill_color,
        fill_mode: el.fill_mode,
        fill_x1: el.fill_x1,
        fill_y1: el.fill_y1,
      } as ShapeElement;
    case "text":
      return {
        ...common,
        type: "text",
        text: el.text,
        font_family: el.font_family,
        font_weight: el.font_weight,
        line_height: el.line_height,
        font_size_minimum: el.font_size_minimum,
        font_size_maximum: el.font_size_maximum,
        fill_color: el.fill_color,
        background_color: el.background_color,
        y_alignment: el.y_alignment,
        y_padding: el.y_padding,
        shadow_color: el.shadow_color,
        shadow_blur: el.shadow_blur,
        shadow_x: el.shadow_x,
        shadow_y: el.shadow_y,
      } as TextElement;
    default:
      return null;
  }
}

function mapComposition(el: any): CompositionElement {
  const children = Array.isArray(el.elements)
    ? el.elements.map(mapVisual).filter((e): e is VisualElement => e !== null)
    : [];
  return {
    type: "composition",
    name: el.name,
    duration: Number(el.duration) || 0,
    fill_color: el.fill_color,
    shadow_color: el.shadow_color,
    shadow_x: el.shadow_x,
    shadow_y: el.shadow_y,
    elements: children,
  };
}

/**
 * Parse the Creatomate horizontal template and extract audio and compositions.
 */
export function parseTemplateHorizontal(file = "template_horizontal.json"): ParsedTemplate {
  const tplPath = join(projectRoot, "template", file);
  const raw = JSON.parse(readFileSync(tplPath, "utf8"));
  const audios: AudioElement[] = [];
  const compositions: CompositionElement[] = [];
  const rootEls: any[] = raw.elements || [];

  rootEls.forEach((el) => {
    if (el.type === "audio") {
      const a: AudioElement = {
        type: "audio",
        name: el.name,
        source: el.source,
        volume: el.volume,
        loop: el.loop,
        audio_fade_in: el.audio_fade_in,
        audio_fade_out: el.audio_fade_out,
        duration: el.duration,
        time: el.time,
      };
      audios.push(a);
    } else if (el.type === "composition") {
      compositions.push(mapComposition(el));
    }
  });

  return { audios, compositions };
}

/**
 * Fill parsed template with local asset paths and text from modifications.
 */
export function hydrateTemplate(mods: Modifications): ParsedTemplate {
  const parsed = parseTemplateHorizontal();

  const audios = parsed.audios.map((a) => {
    if (a.name?.startsWith("TTS-")) {
      const idx = parseInt(a.name.split("-")[1] || "0", 10);
      const local = GetLocalAsset("tts", idx);
      if (local) return { ...a, source: local };
    }
    return a;
  });

  const compositions = parsed.compositions.map((c) => {
    const elements = c.elements.map((el) => {
      if (el.type === "image") {
        if (el.name === "Logo") {
          const logo = GetLocalAsset("logo");
          if (logo) return { ...el, source: logo };
        }
        const m = el.name?.match(/Immagine-(\d+)/);
        if (m) {
          const idx = parseInt(m[1], 10);
          const local = GetLocalAsset("img", idx);
          if (local) return { ...el, source: local };
        }
      } else if (el.type === "text" && el.name && mods[el.name] !== undefined) {
        return { ...el, text: String(mods[el.name]) };
      }
      return el;
    });
    return { ...c, elements };
  });

  return { audios, compositions };
}
