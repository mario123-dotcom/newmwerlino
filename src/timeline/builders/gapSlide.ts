import { join } from "path";
import type { TemplateDoc } from "../../template";
import { getLogoBoxFromTemplate } from "../templateHelpers";
import { paths } from "../../paths";
import type { SlideSpec } from "../types";

type GapTarget = number | string;

export function createGapSlide(
  template: TemplateDoc,
  target: GapTarget,
  videoW: number,
  videoH: number,
  fps: number,
  durationSec: number
): SlideSpec {
  const logoBox = getLogoBoxFromTemplate(template, target);
  const fallback = { w: 240, h: 140 };
  const width = Math.max(1, Math.min(videoW, logoBox.w ?? fallback.w));
  const height = Math.max(1, Math.min(videoH, logoBox.h ?? fallback.h));
  const centerX = Math.round((videoW - width) / 2);
  const centerY = Math.round((videoH - height) / 2);

  return {
    width: videoW,
    height: videoH,
    fps,
    durationSec,
    outPath: "",
    logoPath: join(paths.images, "logo.png"),
    logoWidth: width,
    logoHeight: height,
    logoX: centerX,
    logoY: centerY,
    backgroundAnimated: false,
  };
}
