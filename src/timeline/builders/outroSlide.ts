import { join } from "path";
import { paths } from "../../paths";
import { findChildByName, findComposition, type TemplateDoc, type TemplateElement } from "../../template";
import {
  buildCopyrightBlock,
  defaultTextBlock,
  getFontFamilyFromTemplate,
  getLogoBoxFromTemplate,
  getTextBoxFromTemplate,
} from "../templateHelpers";
import { buildTextBlocks } from "./textBlocks";
import { deriveFontSizing, computeWidthScaleFromTemplate } from "../text";
import { findFontPath } from "../assets";
import { parseSec } from "../utils";
import { outroBackgroundNameCandidates, extractShadow, findShadowSource, extractShadowFromMods } from "../shadows";
import type { SlideSpec, TextBlockSpec, ShadowInfo } from "../types";
import { createGapSlide } from "./gapSlide";
import { MIN_FONT_SIZE } from "../constants";

type OutroParams = {
  mods: Record<string, any>;
  template: TemplateDoc;
  templateWidth: number;
  videoW: number;
  videoH: number;
  fps: number;
  defaultDuration: number;
  prevEnd: number;
  fileIndex: number;
};

type OutroResult = {
  gap?: SlideSpec;
  slide?: SlideSpec;
  endTime: number;
};

function isVisibleFlag(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return !(normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off");
  }
  return true;
}

function centerTextBox(
  box: { x: number; y: number; w: number; h: number },
  logoBox: { x?: number; w?: number },
  videoW: number
): { x: number; y: number; w: number; h: number } {
  if (!(box.w > 0) || !(videoW > 0)) return box;
  let centerTarget: number | undefined;
  if (typeof logoBox.x === "number" && typeof logoBox.w === "number") {
    centerTarget = logoBox.x + logoBox.w / 2;
  } else {
    centerTarget = videoW / 2;
  }
  if (!Number.isFinite(centerTarget)) return box;
  const desiredLeft = Math.round(centerTarget - box.w / 2);
  const maxLeft = Math.max(0, videoW - box.w);
  const safeLeft = Math.max(0, Math.min(maxLeft, desiredLeft));
  if (safeLeft === box.x) return box;
  return { ...box, x: safeLeft };
}

function buildOutroTexts(
  text: string,
  fileIndex: number,
  textBox: { x: number; y: number; w: number; h: number },
  baseBlock: TextBlockSpec,
  templateElement: TemplateElement | undefined,
  videoW: number,
  videoH: number,
  templateWidth: number
): TextBlockSpec[] {
  const widthScale = computeWidthScaleFromTemplate(templateElement, textBox.w, templateWidth);
  const layoutWidth = widthScale > 1 && textBox.w > 0 ? Math.round(textBox.w / widthScale) : textBox.w;
  const layout = typeof layoutWidth === "number" && layoutWidth > 0 ? { ...textBox, w: layoutWidth } : textBox;
  const fontSizing = deriveFontSizing(templateElement, baseBlock.fontSize ?? MIN_FONT_SIZE, videoW, videoH, {
    scaleMultiplier: widthScale,
  });
  const result = buildTextBlocks({
    text,
    fileIndex,
    textBox,
    layoutBox: layout,
    baseBlock,
    fontSizing,
    widthScale,
    videoW,
    videoH,
    templateElement,
    defaultAlignX: 0.5,
    respectManualBreaks: true,
  });
  return result.blocks;
}

function collectOutroShadowSources(
  comp: TemplateElement | undefined,
  mods: Record<string, any>,
  videoW: number,
  videoH: number
): Array<() => ShadowInfo | undefined> {
  const candidates = outroBackgroundNameCandidates();
  return [
    () => extractShadow(comp, videoW, videoH),
    () => extractShadow(findShadowSource(comp, candidates), videoW, videoH),
    () => extractShadowFromMods(mods, "Outro", videoW, videoH),
    ...candidates.map((name) => () => extractShadowFromMods(mods, name, videoW, videoH)),
  ];
}

export function buildOutroSegment(params: OutroParams): OutroResult {
  const { mods, template, templateWidth, videoW, videoH, fps, defaultDuration, prevEnd, fileIndex } = params;
  const outroComp = findComposition(template, "Outro");
  if (!outroComp) {
    return { endTime: prevEnd };
  }

  const visible =
    outroComp.visible !== false &&
    isVisibleFlag(mods["Outro.visible"]);
  if (!visible) {
    return { endTime: prevEnd };
  }

  const outroStart = parseSec(mods["Outro.time"], prevEnd);
  let gap: SlideSpec | undefined;
  let currentStart = prevEnd;
  if (outroStart > prevEnd + 0.001) {
    const gapDuration = outroStart - prevEnd;
    gap = createGapSlide(template, "Outro", videoW, videoH, fps, gapDuration);
    currentStart = outroStart;
  }

  const duration = parseSec(mods["Outro.duration"], parseSec(outroComp.duration, defaultDuration));
  const logoBox = getLogoBoxFromTemplate(template, "Outro");
  const textEl = findChildByName(outroComp, "Testo-outro") as TemplateElement | undefined;
  const rawBox =
    getTextBoxFromTemplate(template, "Outro", "Testo-outro", {
      preserveAnchor: true,
    }) || { x: 0, y: 0, w: 0, h: 0 };
  const textBox = centerTextBox(rawBox, logoBox, videoW);
  const fontFamily = getFontFamilyFromTemplate(template, "Outro", "Testo-outro");
  const fontPath = fontFamily ? findFontPath(fontFamily) : undefined;
  const textValue = typeof textEl?.text === "string" ? textEl.text.trim() : "";
  let texts: TextBlockSpec[] | undefined;

  if (textValue) {
    const baseBlock = defaultTextBlock(textBox.x, textBox.y);
    texts = buildOutroTexts(textValue, fileIndex, textBox, baseBlock, textEl, videoW, videoH, templateWidth);
  }

  const copyright = buildCopyrightBlock(
    template,
    mods,
    "Outro",
    "Copyright-outro",
    videoW,
    videoH
  );

  if (copyright) {
    if (!texts) texts = [];
    texts.push(copyright);
  }

  const shadowSources = collectOutroShadowSources(outroComp, mods, videoW, videoH);
  const hasShadow = shadowSources.some((factory) => !!factory());

  const slide: SlideSpec = {
    width: videoW,
    height: videoH,
    fps,
    durationSec: duration,
    outPath: "",
    logoPath: join(paths.images, "logo.png"),
    logoWidth: logoBox.w ?? 240,
    logoHeight: logoBox.h ?? 140,
    logoX: logoBox.x ?? Math.round((videoW - (logoBox.w ?? 240)) / 2),
    logoY: logoBox.y ?? Math.round((videoH - (logoBox.h ?? 140)) / 2),
    fontFile: fontPath,
    texts,
    shadowEnabled: hasShadow ? true : undefined,
  };

  return { gap, slide, endTime: currentStart + duration };
}
