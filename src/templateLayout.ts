import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "./paths";
import type { TemplateElement } from "./renderers/templateObject";

/**
 * Load slide layouts from the main JSON template. Each layout contains
 * the positioned `text` and `image` elements for a slide.
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
      if (child.type !== "image" && child.type !== "text") return;
      const t: TemplateElement = {
        type: child.type === "image" ? "image" : "text",
        name: child.name,
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
        x_anchor: child.x_anchor,
        y_anchor: child.y_anchor,
        fill_color: child.fill_color,
        font_family: child.font_family,
        font_weight: child.font_weight,
      };
      arr.push(t);
    });
    layouts[idx] = arr;
  });

  return layouts;
}
