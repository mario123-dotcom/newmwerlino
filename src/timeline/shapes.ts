import type { TemplateElement } from "../template";
import { pctToPx } from "../template";
import {
  clampRect,
  parseAlpha,
  parseAngleDeg,
  parsePercent,
  parseSec,
  parseShapeColor,
  normalizeAngle,
} from "./utils";
import type { AnimationSpec, ShapeBlockSpec } from "./types";

export function resolveShapeColor(
  element: TemplateElement,
  mods: Record<string, any>,
  compName: string | undefined,
  globalIndex: number
): { color: string; alpha: number } | undefined {
  const candidates: (string | undefined)[] = [];
  const elName = typeof element.name === "string" ? element.name : undefined;
  if (elName) {
    candidates.push(`${elName}.fill_color`, `${elName}.fillColor`);
    if (compName) {
      candidates.push(
        `${compName}.${elName}.fill_color`,
        `${compName}.${elName}.fillColor`
      );
    }
  }
  if (compName) {
    candidates.push(`${compName}.fill_color`, `${compName}.fillColor`);
  }
  if (globalIndex === 0) {
    candidates.push("Shape.fill_color", "Shape.fillColor");
  }
  candidates.push(`Shape-${globalIndex}.fill_color`, `Shape-${globalIndex}.fillColor`);
  if (globalIndex >= 1) {
    candidates.push(
      `Shape-${globalIndex - 1}.fill_color`,
      `Shape-${globalIndex - 1}.fillColor`
    );
  }

  let override: any;
  for (const key of candidates) {
    if (!key) continue;
    const val = mods[key];
    if (typeof val === "string" && val.trim()) {
      override = val;
      break;
    }
  }

  const baseRaw =
    override ?? (element as any)?.fill_color ?? (element as any)?.fillColor;
  const parsed = parseShapeColor(baseRaw);
  if (!parsed) return undefined;
  const opacity = parseAlpha((element as any)?.opacity);
  if (opacity != null && Number.isFinite(opacity)) {
    const clamped = Math.max(0, Math.min(1, opacity));
    parsed.alpha = Math.max(0, Math.min(1, parsed.alpha * clamped));
  }
  return parsed.alpha > 0 ? parsed : undefined;
}

export function extractShapeAnimations(
  element: TemplateElement,
  rect: { width: number; height: number }
): AnimationSpec[] {
  const out: AnimationSpec[] = [];
  const anims = (element as any)?.animations;
  if (!Array.isArray(anims)) return out;
  for (const animation of anims) {
    if (!animation) continue;
    if ((animation as any).reversed) continue;
    const rawTime = (animation as any).time;
    if (typeof rawTime === "string" && rawTime.trim().toLowerCase() === "end") {
      continue;
    }
    const duration = parseSec((animation as any).duration, 0);
    if (!(duration > 0)) continue;
    const time = parseSec(rawTime, 0);
    if (animation.type === "fade") {
      out.push({ type: "fade", time, duration });
    } else if (animation.type === "wipe") {
      const angle =
        parseAngleDeg((animation as any).start_angle) ??
        parseAngleDeg((animation as any).end_angle);
      let direction: "wipeup" | "wipedown" | "wipeleft" | "wiperight" = "wipeup";
      if (typeof angle === "number" && Number.isFinite(angle)) {
        const norm = normalizeAngle(angle);
        if (Math.abs(norm - 90) < 1 || Math.abs(norm - 270) < 1) {
          const anchor =
            parsePercent((animation as any).y_anchor) ??
            parsePercent((element as any)?.y_anchor);
          if (anchor != null) {
            direction = anchor > 0.5 ? "wipedown" : "wipeup";
          } else {
            direction = Math.abs(norm - 270) < 1 ? "wipedown" : "wipeup";
          }
        } else {
          const anchor =
            parsePercent((animation as any).x_anchor) ??
            parsePercent((element as any)?.x_anchor);
          if (anchor != null) {
            direction = anchor > 0.5 ? "wipeleft" : "wiperight";
          } else {
            direction = Math.abs(norm - 180) < 1 ? "wipeleft" : "wiperight";
          }
        }
      } else {
        direction = rect.height >= rect.width ? "wipeup" : "wiperight";
      }
      out.push({ type: "wipe", time, duration, direction });
    }
  }
  return out;
}

export function extractShapesFromComposition(
  comp: TemplateElement | undefined,
  mods: Record<string, any>,
  width: number,
  height: number,
  startIndex: number
): ShapeBlockSpec[] {
  if (!comp || !Array.isArray(comp.elements)) return [];
  const queue: TemplateElement[] = [...comp.elements];
  const shapes: ShapeBlockSpec[] = [];
  while (queue.length) {
    const element = queue.shift();
    if (!element) continue;
    if ((element as any)?.visible === false) continue;
    if (Array.isArray((element as any)?.elements)) {
      queue.push(...(((element as any).elements as TemplateElement[]) || []));
    }
    const type = typeof element.type === "string" ? element.type.toLowerCase() : "";
    if (type !== "shape") continue;
    const fill = (element as any)?.fill_color ?? (element as any)?.fillColor;
    if (Array.isArray(fill)) continue;
    const widthPx = pctToPx((element as any)?.width, width);
    const heightPx = pctToPx((element as any)?.height, height);
    if (!(widthPx && widthPx > 0) || !(heightPx && heightPx > 0)) continue;
    const xPx = pctToPx((element as any)?.x, width);
    const yPx = pctToPx((element as any)?.y, height);
    if (xPx == null || yPx == null) continue;
    const anchorX = parsePercent((element as any)?.x_anchor) ?? 0;
    const anchorY = parsePercent((element as any)?.y_anchor) ?? 0;
    const rect = clampRect(
      xPx - widthPx * anchorX,
      yPx - heightPx * anchorY,
      widthPx,
      heightPx,
      width,
      height
    );
    if (!rect) continue;
    if (rect.w >= width * 0.98 && rect.h >= height * 0.98) continue;
    const globalIndex = startIndex + shapes.length;
    const color = resolveShapeColor(element, mods, comp.name, globalIndex);
    if (!color) continue;
    const animations = extractShapeAnimations(element, { width: rect.w, height: rect.h });
    shapes.push({
      x: rect.x,
      y: rect.y,
      width: rect.w,
      height: rect.h,
      color: color.color,
      alpha: color.alpha,
      animations: animations.length ? animations : undefined,
    });
  }
  return shapes;
}
