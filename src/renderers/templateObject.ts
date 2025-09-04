import { runFFmpeg } from "../ffmpeg/run";
import { parsePercent } from "../utils/num";

export interface TemplateElement {
  type: "text" | "image";
  name?: string;
  text?: string;
  fill_color?: string;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
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
  opts: { fps: number; videoW: number; videoH: number; fontPath: string }
) {
  const { fps, videoW, videoH, fontPath } = opts;
  const x = el.x ? Math.round(parsePercent(el.x) * videoW) : 0;
  const y = el.y ? Math.round(parsePercent(el.y) * videoH) : 0;
  const baseArgs = ["-y", "-f", "lavfi", "-t", `${duration}`, "-r", `${fps}`, "-i", `color=c=black:s=${videoW}x${videoH}:r=${fps}`];
  const audioArgs = ["-f", "lavfi", "-t", `${duration}`, "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const args: string[] = baseArgs.concat(audioArgs);

  let filter = "";
  if (el.type === "text") {
    const text = (el.text || "").replace(/:/g, '\\:');
    const color = el.fill_color || "white";
    const fontsize = el.height ? Math.round(parsePercent(el.height) * videoH) : 48;
    filter = `[0:v]drawtext=fontfile=${fontPath}:text='${text}':x=${x}:y=${y}:fontsize=${fontsize}:fontcolor=${color}[v]`;
  } else if (el.type === "image") {
    if (!el.file) throw new Error("image element missing file path");
    args.push("-loop", "1", "-t", `${duration}`, "-i", el.file);
    filter = `[0:v][2:v]overlay=x=${x}:y=${y}[v]`;
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
  opts: { fps: number; videoW: number; videoH: number; fontPath: string }
) {
  const { fps, videoW, videoH, fontPath } = opts;
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
    const x = el.x ? Math.round(parsePercent(el.x) * videoW) : 0;
    const y = el.y ? Math.round(parsePercent(el.y) * videoH) : 0;
    const outLbl = `[v${idx + 1}]`;
    if (el.type === "text") {
      const text = (el.text || "").replace(/:/g, '\\:');
      const color = el.fill_color || "white";
      const fontsize = el.height ? Math.round(parsePercent(el.height) * videoH) : 48;
      filter += `${cur}drawtext=fontfile=${fontPath}:text='${text}':x=${x}:y=${y}:fontsize=${fontsize}:fontcolor=${color}${outLbl};`;
    } else if (el.type === "image") {
      if (!el.file) return; // skip if missing file
      args.push("-loop", "1", "-t", `${duration}`, "-i", el.file);
      filter += `${cur}[${imgInput}:v]overlay=x=${x}:y=${y}${outLbl};`;
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
