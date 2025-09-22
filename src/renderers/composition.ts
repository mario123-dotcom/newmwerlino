import { buildDrawText } from "../ffmpeg/filters";
import type { AnimationSpec, ShapeBlockSpec, SlideSpec, TextBlockSpec } from "../timeline";
import { getDefaultFontPath } from "../template";

export type TextLayerPlan = {
  index: number;
  origin: { x: number; y: number };
  fontFile: string;
  drawCommand: string;
  spec: TextBlockSpec;
  background?: TextBlockSpec["background"];
  animations: AnimationSpec[];
};

export type ShapeLayerPlan = {
  index: number;
  spec: ShapeBlockSpec;
  alpha: number;
};

export type SlideRenderPlan = {
  kind: "slide";
  label: string;
  outputPath: string;
  durationSec: number;
  fps: number;
  width: number;
  height: number;
  canvasColor: string;
  background?: {
    path: string;
    animated: boolean;
  };
  logo?: {
    path: string;
    width: number;
    height: number;
    x: number;
    y: number;
  };
  textLayers: TextLayerPlan[];
  shapeLayers: ShapeLayerPlan[];
  shadow?: {
    color: string;
    alpha: number;
    width: number;
    height: number;
  };
  audio: {
    ttsPath?: string;
    needsSilencePad: boolean;
  };
};

function clampAlpha(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), 1);
}

function computeShadow(slide: SlideSpec, width: number, height: number) {
  const wantsShadow =
    !!slide.bgImagePath &&
    (slide.shadowEnabled ||
      slide.shadowColor != null ||
      slide.shadowAlpha != null ||
      slide.shadowW != null ||
      slide.shadowH != null);

  if (!wantsShadow) {
    return undefined;
  }

  const color = slide.shadowColor && slide.shadowColor.trim() ? slide.shadowColor : "black";
  const alpha = clampAlpha(slide.shadowAlpha, 1);
  const fallbackShadowW = width * 1.35;
  const fallbackShadowH = height * 1.45;
  const sw = Math.max(typeof slide.shadowW === "number" ? slide.shadowW : fallbackShadowW, 1);
  const sh = Math.max(typeof slide.shadowH === "number" ? slide.shadowH : fallbackShadowH, 1);

  return {
    color,
    alpha,
    width: sw,
    height: sh,
  };
}

function buildTextLayerPlan(
  block: TextBlockSpec,
  index: number,
  durationSec: number,
  defaultFont: string
): TextLayerPlan {
  const fontFile = block.fontFile ?? defaultFont;
  const drawCommand = buildDrawText({
    label: `tx_${index}`,
    textFile: block.textFile,
    text: block.text,
    fontFile,
    fontSize: block.fontSize ?? 60,
    fontColor: block.fontColor ?? "white",
    xExpr: String(block.x),
    yExpr: String(block.y),
    lineSpacing: block.lineSpacing ?? 8,
    box: !!block.box,
    boxColor: block.boxColor ?? "black",
    boxAlpha: block.boxAlpha ?? 0,
    boxBorderW: block.boxBorderW ?? 0,
    enableExpr: `between(t,0,${durationSec})`,
  });

  return {
    index,
    origin: { x: block.x, y: block.y },
    fontFile,
    drawCommand,
    spec: block,
    background: block.background,
    animations: block.animations ?? [],
  };
}

function buildShapeLayerPlan(block: ShapeBlockSpec, index: number): ShapeLayerPlan {
  const alpha = clampAlpha(block.alpha, 1);
  return {
    index,
    spec: block,
    alpha,
  };
}

export async function renderSlideSegment(slide: SlideSpec): Promise<SlideRenderPlan> {
  const width = slide.width ?? 1920;
  const height = slide.height ?? 1080;
  const durationSec = Number(slide.durationSec.toFixed(4));
  const fps = slide.fps;
  const defaultFont = slide.fontFile ?? getDefaultFontPath();

  const textLayers = (slide.texts ?? []).map((block, index) =>
    buildTextLayerPlan(block, index, durationSec, defaultFont)
  );
  const shapeLayers = (slide.shapes ?? []).map((block, index) => buildShapeLayerPlan(block, index));
  const shadow = computeShadow(slide, width, height);

  return {
    kind: "slide",
    label: `slide-${slide.outPath}`,
    outputPath: slide.outPath,
    durationSec,
    fps,
    width,
    height,
    canvasColor: "black",
    background: slide.bgImagePath
      ? { path: slide.bgImagePath, animated: !!slide.backgroundAnimated }
      : undefined,
    logo: slide.logoPath
      ? {
          path: slide.logoPath,
          width: slide.logoWidth ?? 240,
          height: slide.logoHeight ?? 140,
          x: slide.logoX ?? 161,
          y: slide.logoY ?? 713,
        }
      : undefined,
    textLayers,
    shapeLayers,
    shadow,
    audio: {
      ttsPath: slide.ttsPath ?? undefined,
      needsSilencePad: !slide.ttsPath,
    },
  };
}
