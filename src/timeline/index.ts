export { buildTimelineFromLayout } from "./builders/timeline";
export {
  defaultTextBlock,
  getFontFamilyFromTemplate,
  getLogoBoxFromTemplate,
  getTextBoxFromTemplate,
  buildCopyrightBlock,
} from "./templateHelpers";
export {
  wrapText,
  maxCharsForWidth,
  computeLineSpacingForBox,
  deriveFontSizing,
  computeWidthScaleFromTemplate,
  parseLineHeightFactor,
  parseLetterSpacing,
  parseAlignmentFactor,
  applyHorizontalAlignment,
  applyExtraBackgroundPadding,
  resolveTextLayout,
  fitTextWithTargetFont,
  clampMaxChars,
  LINE_WIPE_DURATION,
  LINE_WIPE_OVERLAP,
} from "./text";
export {
  extractShadow,
  extractShadowFromMods,
  findShadowSource,
  slideBackgroundNameCandidates,
  outroBackgroundNameCandidates,
} from "./shadows";
export {
  findImageForSlide,
  findTTSForSlide,
  findFontPath,
  writeTextFilesForSlide,
} from "./assets";
export {
  resolveShapeColor,
  extractShapeAnimations,
  extractShapesFromComposition,
} from "./shapes";
export { parseSec, lenToPx, clampRect, parseRGBA } from "./utils";
export {
  APPROX_CHAR_WIDTH_RATIO,
  DEFAULT_CHARS_PER_LINE,
  MIN_FONT_SIZE,
} from "./constants";
export type {
  AnimationSpec,
  TextBlockSpec,
  ShapeBlockSpec,
  SlideSpec,
  ShadowInfo,
  FontSizingInfo,
  DeriveFontOptions,
  TextLayoutResult,
} from "./types";
