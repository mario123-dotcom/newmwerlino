import { runFFmpeg } from "../ffmpeg/run";
import { parsePercent } from "../utils/num";
import { ffmpegSafePath } from "../utils/ffmpeg";
import { escDrawText, fitText } from "../utils/text";

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
  videoW?: number,
  videoH?: number,
): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number") return Math.round(val);
  if (/^\d+(\.\d+)?%$/.test(val)) return Math.round(parsePercent(val) * base);
  if (
    /^\d+(\.\d+)?\s*vmin$/.test(String(val)) &&
    typeof videoW === "number" &&
    typeof videoH === "number"
  ) {
    const v = parseFloat(String(val));
    const ref = Math.min(videoW, videoH);
    return Math.round(v * ref);
  }
  const n = parseFloat(String(val));
  return isNaN(n) ? undefined : Math.round(n);
}

function pickWipeDirection(anim: any): string {
  if (!anim) return "wipeup";
  if (anim.x_anchor === "0%") return "wiperight";
  if (anim.x_anchor === "100%") return "wipeleft";
  if (anim.y_anchor === "0%") return "wipedown";
  if (anim.y_anchor === "100%") return "wipeup";
  return "wipeup";
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
  font_size?: string | number;
  font_size_minimum?: string | number;
  font_size_maximum?: string | number;
  line_height?: string;
  animations?: any[];
  file?: string; // for image
  fit?: string; // for image scaling
  background_color?: string;
  shadow_color?: string;
  shadow_x?: string | number;
  shadow_y?: string | number;
  shadow_blur?: string | number;

  [key: string]: any; // preserva proprietà aggiuntive
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
  const w = dimToPx(el.width, videoW, videoW, videoH);
  const h = dimToPx(el.height, videoH, videoW, videoH);
  const x = dimToPx(el.x, videoW, videoW, videoH) ?? 0;
  const y = dimToPx(el.y, videoH, videoW, videoH) ?? 0;
  const ax = w && el.x_anchor ? parsePercent(el.x_anchor) * w : 0;
  const ay = h && el.y_anchor ? parsePercent(el.y_anchor) * h : 0;
  const finalX = x - ax;
  const finalY = y - ay;

  const baseArgs = ["-y", "-f", "lavfi", "-t", `${duration}`, "-r", `${fps}`, "-i", `color=c=black:s=${videoW}x${videoH}:r=${fps}`];
  const audioArgs = ["-f", "lavfi", "-t", `${duration}`, "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const args: string[] = baseArgs.concat(audioArgs);

  let filter = "";
  if (el.type === "text") {
    const color = normalizeColor(el.fill_color || "white");
    const baseSize =
      dimToPx(el.font_size, videoH, videoW, videoH) ??
      dimToPx(el.height, videoH, videoW, videoH) ??
      48;
    const minFont = dimToPx(el.font_size_minimum, videoH, videoW, videoH);
    const maxFont = dimToPx(el.font_size_maximum, videoH, videoW, videoH);
    const lineFactor = el.line_height
      ? parsePercent(el.line_height)
      : 1.2;
    const fitted = fitText(
      el.text || "",
      w ?? videoW,
      h ?? videoH,
      baseSize,
      lineFactor,
    );
    let fontsize = fitted.fontSize;
    if (minFont !== undefined) fontsize = Math.max(fontsize, minFont);
    if (maxFont !== undefined) fontsize = Math.min(fontsize, maxFont);
    const text = escDrawText(fitted.text);
    const font = ffmpegSafePath(pickFont(el.font_family));
    const boxColor = el.background_color
      ? normalizeColor(el.background_color)
      : undefined;
    const shadowColor = el.shadow_color
      ? normalizeColor(el.shadow_color)
      : undefined;
    const shadowX = dimToPx(el.shadow_x, videoW, videoW, videoH) ?? 0;
    const shadowY = dimToPx(el.shadow_y, videoH, videoW, videoH) ?? 0;
    const lineSpacing = Math.round(fontsize * (lineFactor - 1));
    const extra =
      (boxColor ? `:box=1:boxcolor=${boxColor}` : "") +
      (shadowColor
        ? `:shadowcolor=${shadowColor}:shadowx=${shadowX}:shadowy=${shadowY}`
        : "") +
      (lineSpacing ? `:line_spacing=${lineSpacing}` : "");
    const anim = Array.isArray(el.animations) ? el.animations[0] : undefined;
    if (anim && (anim.type === "wipe" || anim.type === "text-reveal")) {
      const dir = pickWipeDirection(anim);
      const start = typeof anim.time === "number" ? anim.time : 0;
      const dur = typeof anim.duration === "number" ? anim.duration : 0.6;
      filter =
        `color=c=black@0.0:s=${videoW}x${videoH}:r=${fps}:d=${duration},format=rgba,setsar=1[t_can];` +
        `[t_can]drawtext=fontfile='${font}':text='${text}':x=${finalX}:y=${finalY}:fontsize=${fontsize}:fontcolor=${color}${extra}[t_rgba];` +
        `[t_rgba]split=2[t_rgb][t_forA];` +
        `[t_forA]alphaextract,format=gray,setsar=1[t_Aorig];` +
        `color=c=black:s=${videoW}x${videoH}:r=${fps}:d=${duration},format=gray,setsar=1[t_off];` +
        `color=c=white:s=${videoW}x${videoH}:r=${fps}:d=${duration},format=gray,setsar=1[t_on];` +
        `[t_off][t_on]xfade=transition=${dir}:duration=${dur.toFixed(3)}:offset=${start.toFixed(3)}[t_wipe];` +
        `[t_Aorig][t_wipe]blend=all_mode=multiply[t_A];` +
        `[t_rgb][t_A]alphamerge[t_ready];` +
        `[0:v][t_ready]overlay=x=0:y=0[v]`;
    } else {
      let alphaPart = "";
      if (anim && anim.type === "fade") {
        const start = typeof anim.time === "number" ? anim.time : 0;
        const dur = typeof anim.duration === "number" ? anim.duration : 1;
        const end = start + dur;
        alphaPart = `:alpha='if(lt(t,${start.toFixed(3)}),0,if(lt(t,${end.toFixed(3)}),(t-${start.toFixed(3)})/${dur.toFixed(3)},1))'`;
      }
      filter = `[0:v]drawtext=fontfile='${font}':text='${text}':x=${finalX}:y=${finalY}:fontsize=${fontsize}:fontcolor=${color}${extra}${alphaPart}[v]`;
    }
  } else if (el.type === "image") {
    if (!el.file) throw new Error("image element missing file path");
    args.push("-loop", "1", "-t", `${duration}`, "-i", el.file);
    const src = `[2:v]`;
    let imgLbl = src;
    if (w || h) {
      const fit = el.fit;
      if (fit === "contain" && w && h) {
        filter = `${src}scale=${w}:${h}:force_original_aspect_ratio=decrease,format=rgba,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0[s0];`;
      } else {
        const sw = w ?? -1;
        const sh = h ?? -1;
        filter = `${src}scale=${sw}:${sh}[s0];`;
      }
      imgLbl = "[s0]";
    } else {
      filter = `${src}scale=${videoW}:${videoH}:force_original_aspect_ratio=increase,crop=${videoW}:${videoH}[s0];`;
      imgLbl = "[s0]";
    }
    const anim = Array.isArray(el.animations) ? el.animations[0] : undefined;
    if (anim && anim.type === "fade") {
      const start = typeof anim.time === "number" ? anim.time : 0;
      const dur = typeof anim.duration === "number" ? anim.duration : 1;
      filter += `${imgLbl}format=rgba,fade=t=in:st=${start.toFixed(3)}:d=${dur.toFixed(3)}:alpha=1[f0];`;
      imgLbl = "[f0]";
    }
    filter += `[0:v]${imgLbl}overlay=x=${finalX}:y=${finalY}[v]`;
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
  opts: {
    fps: number;
    videoW: number;
    videoH: number;
    fonts: Record<string, string>;
    ttsPath?: string | null;
  }
) {
  const { fps, videoW, videoH, fonts, ttsPath } = opts;
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
    const w = dimToPx(el.width, videoW, videoW, videoH);
    const h = dimToPx(el.height, videoH, videoW, videoH);
    const x = dimToPx(el.x, videoW, videoW, videoH) ?? 0;
    const y = dimToPx(el.y, videoH, videoW, videoH) ?? 0;
    const ax = w && el.x_anchor ? parsePercent(el.x_anchor) * w : 0;
    const ay = h && el.y_anchor ? parsePercent(el.y_anchor) * h : 0;
    const fx = x - ax;
    const fy = y - ay;

    const outLbl = `[v${idx + 1}]`;
    if (el.type === "text") {
      const baseSize =
        dimToPx(el.font_size, videoH, videoW, videoH) ??
        dimToPx(el.height, videoH, videoW, videoH) ??
        48;
      const minFont = dimToPx(el.font_size_minimum, videoH, videoW, videoH);
      const maxFont = dimToPx(el.font_size_maximum, videoH, videoW, videoH);
      const lineFactor = el.line_height
        ? parsePercent(el.line_height)
        : 1.2;
      const fitted = fitText(
        el.text || "",
        w ?? videoW,
        h ?? videoH,
        baseSize,
        lineFactor,
      );
      let fontsize = fitted.fontSize;
      if (minFont !== undefined) fontsize = Math.max(fontsize, minFont);
      if (maxFont !== undefined) fontsize = Math.min(fontsize, maxFont);
      const text = escDrawText(fitted.text);
      const color = normalizeColor(el.fill_color || "white");
      const font = ffmpegSafePath(pickFont(el.font_family));
      const boxColor = el.background_color
        ? normalizeColor(el.background_color)
        : undefined;
      const shadowColor = el.shadow_color
        ? normalizeColor(el.shadow_color)
        : undefined;
      const shadowX = dimToPx(el.shadow_x, videoW, videoW, videoH) ?? 0;
      const shadowY = dimToPx(el.shadow_y, videoH, videoW, videoH) ?? 0;
      const lineSpacing = Math.round(fontsize * (lineFactor - 1));
      const extra =
        (boxColor ? `:box=1:boxcolor=${boxColor}` : "") +
        (shadowColor
          ? `:shadowcolor=${shadowColor}:shadowx=${shadowX}:shadowy=${shadowY}`
          : "") +
        (lineSpacing ? `:line_spacing=${lineSpacing}` : "");
      const anim = Array.isArray(el.animations) ? el.animations[0] : undefined;
      if (anim && (anim.type === "wipe" || anim.type === "text-reveal")) {
        const dir = pickWipeDirection(anim);
        const start = typeof anim.time === "number" ? anim.time : 0;
        const dur = typeof anim.duration === "number" ? anim.duration : 0.6;
        filter +=
          `color=c=black@0.0:s=${videoW}x${videoH}:r=${fps}:d=${duration},format=rgba,setsar=1[t${idx}_can];` +
          `[t${idx}_can]drawtext=fontfile='${font}':text='${text}':x=${fx}:y=${fy}:fontsize=${fontsize}:fontcolor=${color}${extra}[t${idx}_rgba];` +
          `[t${idx}_rgba]split=2[t${idx}_rgb][t${idx}_forA];` +
          `[t${idx}_forA]alphaextract,format=gray,setsar=1[t${idx}_Aorig];` +
          `color=c=black:s=${videoW}x${videoH}:r=${fps}:d=${duration},format=gray,setsar=1[t${idx}_off];` +
          `color=c=white:s=${videoW}x${videoH}:r=${fps}:d=${duration},format=gray,setsar=1[t${idx}_on];` +
          `[t${idx}_off][t${idx}_on]xfade=transition=${dir}:duration=${dur.toFixed(3)}:offset=${start.toFixed(3)}[t${idx}_wipe];` +
          `[t${idx}_Aorig][t${idx}_wipe]blend=all_mode=multiply[t${idx}_A];` +
          `[t${idx}_rgb][t${idx}_A]alphamerge[t${idx}_ready];` +
          `${cur}[t${idx}_ready]overlay=x=0:y=0${outLbl};`;
      } else {
        let alphaPart = "";
        if (anim && anim.type === "fade") {
          const start = typeof anim.time === "number" ? anim.time : 0;
          const dur = typeof anim.duration === "number" ? anim.duration : 1;
          const end = start + dur;
          alphaPart = `:alpha='if(lt(t,${start.toFixed(3)}),0,if(lt(t,${end.toFixed(3)}),(t-${start.toFixed(3)})/${dur.toFixed(3)},1))'`;
        }
        filter += `${cur}drawtext=fontfile='${font}':text='${text}':x=${fx}:y=${fy}:fontsize=${fontsize}:fontcolor=${color}${extra}${alphaPart}${outLbl};`;
      }
    } else if (el.type === "image") {
      if (!el.file) return; // skip if missing file
      args.push("-loop", "1", "-t", `${duration}`, "-i", el.file);

      const src = `[${imgInput}:v]`;
      let imgLbl = src;
      if (w || h) {
        const fit = el.fit;
        if (fit === "contain" && w && h) {
          filter += `${src}scale=${w}:${h}:force_original_aspect_ratio=decrease,format=rgba,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0[s${idx}];`;
        } else {
          const sw = w ?? -1;
          const sh = h ?? -1;
          filter += `${src}scale=${sw}:${sh}[s${idx}];`;
        }
        imgLbl = `[s${idx}]`;
      } else {
        filter += `${src}scale=${videoW}:${videoH}:force_original_aspect_ratio=increase,crop=${videoW}:${videoH}[s${idx}];`;
        imgLbl = `[s${idx}]`;
      }
      const anim = Array.isArray(el.animations) ? el.animations[0] : undefined;
      if (anim && anim.type === "fade") {
        const start = typeof anim.time === "number" ? anim.time : 0;
        const dur = typeof anim.duration === "number" ? anim.duration : 1;
        filter += `${imgLbl}format=rgba,fade=t=in:st=${start.toFixed(3)}:d=${dur.toFixed(3)}:alpha=1[f${idx}];`;
        imgLbl = `[f${idx}]`;
      }
      filter += `${cur}${imgLbl}overlay=x=${fx}:y=${fy}${outLbl};`;

      imgInput++;
    }
    cur = outLbl;
  });
  if (filter.endsWith(";")) filter = filter.slice(0, -1);

  // audio track: use TTS if provided, otherwise generate silence
  if (ttsPath) {
    args.push("-i", ttsPath);
  } else {
    args.push(
      "-f",
      "lavfi",
      "-t",
      `${duration}`,
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100"
    );
  }
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
