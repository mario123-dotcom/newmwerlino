import { readFileSync } from "fs";
import { join } from "path";
import { projectRoot } from "./paths";
import type { TemplateElement } from "./renderers/templateObject";

export interface SlideLayout {
  props: Record<string, any>;
  elements: TemplateElement[];
}

/**
 * Load slide layouts from the main JSON template. Each layout contains
 * the positioned `text` and `image` elements for a slide.

 */
export function loadSlideLayouts(
  file: string = "template_horizontal.json"
): Record<number, SlideLayout> {
  const tplPath = join(projectRoot, "template", file);
  const raw = JSON.parse(readFileSync(tplPath, "utf8"));
  const layouts: Record<number, SlideLayout> = {};
  const svgDir = join(projectRoot, "template", "svg");
  const sanitize = (n: string) => String(n || "").replace(/[^a-zA-Z0-9_-]/g, "_");

  const rootEls: any[] = raw.elements || [];
  rootEls.forEach((el: any) => {
    const name: string = el.name || "";
    const m = name.match(/^Slide_(\d+)$/);
    if (!m) return;
    const idx = parseInt(m[1]!, 10);
    const arr: TemplateElement[] = [];
    (el.elements || []).forEach((child: any) => {
      if (child.type === "text" || child.type === "image") {
        const t: TemplateElement = { ...child };
        arr.push(t);
      } else if (child.type === "shape") {
        const nameS = sanitize(child.name || child.id || "shape");
        const file = join(svgDir, `${nameS}.svg`).replace(/\\/g, "/");
        const t: TemplateElement = { ...child, type: "image", file };
        arr.push(t);
      }
    });
    const { elements, ...props } = el;
    layouts[idx] = { props, elements: arr };
  });

  return layouts;
}
