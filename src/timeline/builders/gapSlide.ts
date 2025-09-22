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
  const fallback = { x: Math.round((videoW - 240) / 2), y: Math.round((videoH - 140) / 2), w: 240, h: 140 };
  const width = Math.max(logoBox.w ?? fallback.w, 1);
  const height = Math.max(logoBox.h ?? fallback.h, 1);
  const x = Math.round((videoW - width) / 2);
  const y = Math.round((videoH - height) / 2);

  return {
    width: videoW,
    height: videoH,
    fps,
    durationSec,
    outPath: "",
    logoPath: join(paths.images, "logo.png"),
    logoWidth: width,
    logoHeight: height,
    logoX: x,
    logoY: y,
    backgroundAnimated: false,
  };
}
