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
  const maxX = Math.max(0, videoW - width);
  const maxY = Math.max(0, videoH - height);
  const rawX = typeof logoBox.x === "number" ? logoBox.x : centerX;
  const rawY = typeof logoBox.y === "number" ? logoBox.y : centerY;
  const x = Math.max(0, Math.min(maxX, Math.round(rawX)));
  const y = Math.max(0, Math.min(maxY, Math.round(rawY)));

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
