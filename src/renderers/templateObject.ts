import { runFFmpeg } from "../ffmpeg/run";
import { parsePercent } from "../utils/num";
import { ffmpegSafePath } from "../utils/ffmpeg";

function escDrawText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:");
}

function normalizeColor(c: string): string {
  const m = c.match(/rgba?\((\d+),(\d+),(\d+)(?:,(\d+(?:\.\d+)?))?\)/);
  if (m) {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
    const r = toHex(m[1]!);
    const g = toHex(m[2]!);
    const b = toHex(m[3]!);
    if (m[4]) {
      const a = Math.round(parseFloat(m[4]!) * 255)
        .toString(16)
        .padStart(2, "0");
      return `#${r}${g}${b}${a}`;
    }
    return `#${r}${g}${b}`;
  }
  return c;
}

function dimToPx(
  val: string | number | undefined,
  base: number,
): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number") return Math.round(val);
  if (/^\d+(\.\d+)?%$/.test(val)) return Math.round(parsePercent(val) * base);
  const n = parseFloat(val);
  return isNaN(n) ? undefined : Math.round(n);
}

export interface TemplateElement {
  type: "text" | "image";
  name?: string;
  text?: string;
  fill_color?: string;
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  x_anchor?: string | number;
  y_anchor?: string | number;
  font_family?: string;
  font_weight?: string;
  file?: string; // for image
}

/**
 * Render a single template element into a video slide using FFmpeg.
 * Supports basic `text` and `image` elements.
 */
export function renderTemplateElement(
  el: TemplateElement,
  duration: number,
  outPath: string,
  opts: { fps: number; videoW: number; videoH: number; fonts: Record<string, string> }
) {
  const { fps, videoW, videoH, fonts } = opts;
  const pickFont = (family?: string) => {
    const f = family && fonts[family];
    return f || Object.values(fonts)[0] || "";
  };
  const w = dimToPx(el.width, videoW);
  const h = dimToPx(el.height, videoH);
  const x = dimToPx(el.x, videoW) ?? 0;
  const y = dimToPx(el.y, videoH) ?? 0;
  const ax = w && el.x_anchor ? parsePercent(el.x_anchor) * w : 0;
  const ay = h && el.y_anchor ? parsePercent(el.y_anchor) * h : 0;
  const finalX = x - ax;
  const finalY = y - ay;
  const baseArgs = ["-y", "-f", "lavfi", "-t", `${duration}`, "-r", `${fps}`, "-i", `color=c=black:s=${videoW}x${videoH}:r=${fps}`];
  const audioArgs = ["-f", "lavfi", "-t", `${duration}`, "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const args: string[] = baseArgs.concat(audioArgs);

  let filter = "";
  if (el.type === "text") {
    const text = escDrawText(el.text || "");
    const color = normalizeColor(el.fill_color || "white");
    const fontsize = dimToPx(el.height, videoH) ?? 48;
    const font = ffmpegSafePath(pickFont(el.font_family));
    filter = `[0:v]drawtext=fontfile=${font}:text='${text}':x=${finalX}:y=${finalY}:fontsize=${fontsize}:fontcolor=${color}[v]`;
  } else if (el.type === "image") {
    if (!el.file) throw new Error("image element missing file path");
    args.push("-loop", "1", "-t", `${duration}`, "-i", el.file);
    if (w || h) {
      const sw = w ?? -1;
      const sh = h ?? -1;
      filter = `[2:v]scale=${sw}:${sh}[s0];[0:v][s0]overlay=x=${finalX}:y=${finalY}[v]`;
    } else {
      filter = `[0:v][2:v]overlay=x=${finalX}:y=${finalY}[v]`;
    }
  } else {
    throw new Error(`Unsupported element type: ${el.type}`);
  }

  args.push("-filter_complex", filter, "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-shortest", outPath);

  runFFmpeg(args, "FFmpeg TEMPLATE");
}

/**
 * Render a full slide composed of multiple template elements.
 * Elements are drawn in the order they appear in the array.
 */
export function renderTemplateSlide(
  elements: TemplateElement[],
  duration: number,
  outPath: string,
  opts: { fps: number; videoW: number; videoH: number; fonts: Record<string, string> }
) {
  const { fps, videoW, videoH, fonts } = opts;
  const pickFont = (family?: string) => {
    const f = family && fonts[family];
    return f || Object.values(fonts)[0] || "";
  };
  const args: string[] = [
    "-y",
    "-f",
    "lavfi",
    "-t",
    `${duration}`,
    "-r",
    `${fps}`,
    "-i",
    `color=c=black:s=${videoW}x${videoH}:r=${fps}`,
  ];

  let filter = "";
  let cur = "[0:v]";
  let imgInput = 1;
  elements.forEach((el, idx) => {
    const w = dimToPx(el.width, videoW);
    const h = dimToPx(el.height, videoH);
    const x = dimToPx(el.x, videoW) ?? 0;
    const y = dimToPx(el.y, videoH) ?? 0;
    const ax = w && el.x_anchor ? parsePercent(el.x_anchor) * w : 0;
    const ay = h && el.y_anchor ? parsePercent(el.y_anchor) * h : 0;
    const fx = x - ax;
    const fy = y - ay;
    const outLbl = `[v${idx + 1}]`;
    if (el.type === "text") {
      const text = escDrawText(el.text || "");
      const color = normalizeColor(el.fill_color || "white");
      const fontsize = dimToPx(el.height, videoH) ?? 48;
      const font = ffmpegSafePath(pickFont(el.font_family));
      filter += `${cur}drawtext=fontfile=${font}:text='${text}':x=${fx}:y=${fy}:fontsize=${fontsize}:fontcolor=${color}${outLbl};`;
    } else if (el.type === "image") {
      if (!el.file) return; // skip if missing file
      args.push("-loop", "1", "-t", `${duration}`, "-i", el.file);
      const src = `[${imgInput}:v]`;
      let imgLbl = src;
      if (w || h) {
        const sw = w ?? -1;
        const sh = h ?? -1;
        filter += `${src}scale=${sw}:${sh}[s${idx}];`;
        imgLbl = `[s${idx}]`;
      }
      filter += `${cur}${imgLbl}overlay=x=${fx}:y=${fy}${outLbl};`;
      imgInput++;
    }
    cur = outLbl;
  });
  if (filter.endsWith(";")) filter = filter.slice(0, -1);

  // silent audio
  args.push(
    "-f",
    "lavfi",
    "-t",
    `${duration}`,
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100"
  );
  const audioIdx = imgInput; // after images

  if (filter) args.push("-filter_complex", filter, "-map", cur, "-map", `${audioIdx}:a`);
  else args.push("-map", "0:v", "-map", `${audioIdx}:a`);
  args.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    "-shortest",
    outPath
  );

  runFFmpeg(args, "FFmpeg TEMPLATE");
}
