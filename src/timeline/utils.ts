export function parseSec(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase().replace(",", ".");
  if (normalized.endsWith("ms")) {
    const parsed = parseFloat(normalized.replace("ms", ""));
    return Number.isFinite(parsed) ? parsed / 1000 : fallback;
  }
  if (normalized.endsWith("s")) {
    const parsed = parseFloat(normalized.replace("s", ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function lenToPx(value: unknown, width: number, height: number): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.endsWith("vmin")) {
    const parsed = parseFloat(compact.slice(0, -4));
    return Number.isFinite(parsed) ? (parsed / 100) * Math.min(width, height) : undefined;
  }
  if (compact.endsWith("vmax")) {
    const parsed = parseFloat(compact.slice(0, -4));
    return Number.isFinite(parsed) ? (parsed / 100) * Math.max(width, height) : undefined;
  }
  if (compact.endsWith("vh")) {
    const parsed = parseFloat(compact.slice(0, -2));
    return Number.isFinite(parsed) ? (parsed / 100) * height : undefined;
  }
  if (compact.endsWith("vw")) {
    const parsed = parseFloat(compact.slice(0, -2));
    return Number.isFinite(parsed) ? (parsed / 100) * width : undefined;
  }
  if (compact.endsWith("px")) {
    const parsed = parseFloat(compact.slice(0, -2));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const parsed = parseFloat(compact);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function clampRect(
  x: number,
  y: number,
  w: number,
  h: number,
  maxW: number,
  maxH: number
): { x: number; y: number; w: number; h: number } | undefined {
  if (!(w > 0) || !(h > 0)) return undefined;
  if (!(maxW > 0) || !(maxH > 0)) return undefined;

  let left = x;
  let top = y;
  let right = x + w;
  let bottom = y + h;

  left = Math.max(0, Math.min(left, maxW));
  top = Math.max(0, Math.min(top, maxH));
  right = Math.max(left, Math.min(right, maxW));
  bottom = Math.max(top, Math.min(bottom, maxH));

  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) return undefined;

  return {
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(width),
    h: Math.round(height),
  };
}

export function parseAlpha(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.endsWith("%")) {
    const parsed = parseFloat(normalized.slice(0, -1));
    return Number.isFinite(parsed) ? parsed / 100 : undefined;
  }
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseBooleanish(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value === 0 ? false : true;
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "yes", "on", "1"].includes(normalized)) return true;
  if (["false", "no", "off", "0"].includes(normalized)) return false;
  return undefined;
}

export function parseRGBA(input: unknown): { color: string; alpha: number } | undefined {
  if (typeof input !== "string") return undefined;
  const match = input
    .trim()
    .match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i);
  if (!match) return undefined;
  const r = Math.max(0, Math.min(255, parseInt(match[1], 10)));
  const g = Math.max(0, Math.min(255, parseInt(match[2], 10)));
  const b = Math.max(0, Math.min(255, parseInt(match[3], 10)));
  const a = match[4] != null ? Math.max(0, Math.min(1, parseFloat(match[4]))) : 1;
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return { color: `#${hex}`, alpha: a };
}

export function parsePercent(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = value <= 1 && value >= 0 ? value : value / 100;
    if (!Number.isFinite(normalized)) return undefined;
    return Math.max(0, Math.min(1, normalized));
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.endsWith("%")) {
    const parsed = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(0, Math.min(1, parsed / 100));
  }
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  if (Math.abs(parsed) <= 1) {
    return Math.max(0, Math.min(1, parsed));
  }
  return Math.max(0, Math.min(1, parsed / 100));
}

export function parseAngleDeg(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const cleaned = trimmed.replace(/deg$/i, "");
  const withoutDegree = cleaned.endsWith("°") ? cleaned.slice(0, -1) : cleaned;
  const parsed = parseFloat(withoutDegree);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

export function parseShadowColor(raw: unknown): { color: string; alpha?: number } | undefined {
  if (typeof raw !== "string") return undefined;
  const input = raw.trim();
  if (!input) return undefined;
  const rgba = parseRGBA(input);
  if (rgba) return rgba;
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let value = hex[1];
    if (value.length === 3) {
      value = value
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return { color: `#${value.toLowerCase()}` };
  }
  return { color: input };
}

export function parseShadowLength(
  value: unknown,
  axis: "x" | "y",
  width: number,
  height: number
): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;
    if (trimmed.endsWith("%")) {
      const parsed = parseFloat(trimmed.slice(0, -1));
      if (!Number.isFinite(parsed)) return undefined;
      const base = axis === "x" ? width : height;
      return (parsed / 100) * base;
    }
  }
  return lenToPx(value, width, height);
}

export function parseShapeColor(raw: unknown): { color: string; alpha: number } | undefined {
  if (typeof raw !== "string") return undefined;
  const input = raw.trim();
  if (!input) return undefined;
  const rgba = parseRGBA(input);
  if (rgba) return rgba;
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let value = hex[1];
    if (value.length === 3) {
      value = value
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return { color: `#${value.toLowerCase()}`, alpha: 1 };
  }
  return undefined;
}

export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    if (!seen.has(name)) {
      seen.add(name);
      output.push(name);
    }
  }
  return output;
}
