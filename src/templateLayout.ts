import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "./paths";
import type { TemplateElement } from "./renderers/templateObject";

/**
 * Load slide layouts from the main JSON template. Each layout contains
 * the positioned elements (Logo, Immagine-i, Testo-i) for a slide.
 */
export function loadSlideLayouts(
  file: string = "template_horizontal.json"
): Record<number, TemplateElement[]> {
  const tplPath = join(projectRoot, "template", file);
  const raw = JSON.parse(readFileSync(tplPath, "utf8"));
  const layouts: Record<number, TemplateElement[]> = {};

  const rootEls: any[] = raw.elements || [];
  rootEls.forEach((el: any) => {
    const name: string = el.name || "";
    const m = name.match(/^Slide_(\d+)$/);
    if (!m) return;
    const idx = parseInt(m[1]!, 10);
    const arr: TemplateElement[] = [];
    (el.elements || []).forEach((child: any) => {
      const cname: string = child.name || "";
      if (
        cname === "Logo" ||
        cname === `Immagine-${idx}` ||
        cname === `Testo-${idx}`
      ) {
        const t: TemplateElement = {
          type: child.type === "image" ? "image" : "text",
          name: cname,
          x: child.x,
          y: child.y,
          width: child.width,
          height: child.height,
          fill_color: child.fill_color,
        };
        arr.push(t);
      }
    });
    layouts[idx] = arr;
  });

  return layouts;
}
