import { join } from "path";
import type { TemplateDoc } from "../../template";
import { getLogoBoxFromTemplate } from "../templateHelpers";
import { paths } from "../../paths";
import type { SlideSpec } from "../types";

type GapTarget = number | string;

/**
 * Costruisce una slide filler che mostra solo il logo centrato quando esistono
 * gap temporali fra segmenti.
 *
 * @param template Documento Creatomate di riferimento per recuperare il box logo.
 * @param target Indice o nome della slide originale a cui riferirsi.
 * @param videoW Larghezza del video finale.
 * @param videoH Altezza del video finale.
 * @param fps Fotogrammi al secondo del progetto.
 * @param durationSec Durata del gap in secondi da coprire.
 * @returns Uno {@link SlideSpec} minimale con solo il logo visibile.
 */
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
  const x = centerX;
  const y = centerY;

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
