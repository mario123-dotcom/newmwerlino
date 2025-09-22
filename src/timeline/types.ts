export type AnimationSpec =
  | {
      type: "fade";
      time: number | "end";
      duration: number;
      reversed?: boolean;
    }
  | {
      type: "wipe";
      time: number;
      duration: number;
      direction: "wipeleft" | "wiperight" | "wipeup" | "wipedown";
    };

export type TextBlockSpec = {
  textFile?: string;
  text?: string;

  x: number;
  y: number;
  xExpr?: string;

  fontFile?: string;
  fontSize?: number;
  fontColor?: string;
  lineSpacing?: number;
  box?: boolean;
  boxColor?: string;
  boxAlpha?: number;
  boxBorderW?: number;
  background?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    alpha: number;
  };

  animations?: AnimationSpec[];
};

export type ShapeBlockSpec = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  animations?: AnimationSpec[];
};

export type SlideSpec = {
  width?: number;
  height?: number;
  fps: number;
  durationSec: number;
  outPath: string;

  bgImagePath?: string;
  logoPath?: string;
  ttsPath?: string;
  fontFile?: string;

  backgroundAnimated?: boolean;

  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
  logoY?: number;

  texts?: TextBlockSpec[];

  shapes?: ShapeBlockSpec[];

  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowAlpha?: number;
  shadowW?: number;
  shadowH?: number;
};

export type ShadowInfo = {
  color?: string;
  alpha?: number;
  w?: number;
  h?: number;
  declared?: boolean;
};

export type FontSizingInfo = {
  initial: number;
  clamp(value: number): number;
};

export type DeriveFontOptions = {
  scaleMultiplier?: number;
};

export type TextLayoutResult = {
  lines: string[];
  font: number;
  spacing: number;
};
