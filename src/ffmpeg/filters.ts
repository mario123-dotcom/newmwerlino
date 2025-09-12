// Minimal FFmpeg text utilities

// Convert a filesystem path into a form accepted by FFmpeg on any platform.
// Example: `C:\foo\bar` -> `C\:/foo/bar`
export function toFFPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
}

// Escape characters that would otherwise break the drawtext filter.
export function escTextForDrawText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\n/g, "\\n");
}

export type DrawTextOpts = {
  label: string;        // buffer label (e.g. "tx_0")
  textFile?: string;    // path to file containing the text
  text?: string;        // inline text alternative
  fontFile: string;
  fontSize: number;
  fontColor: string;    // e.g. "white"
  xExpr: string;        // expression for x position
  yExpr: string;        // expression for y position
  lineSpacing?: number;
  box?: boolean;
  boxColor?: string;
  boxAlpha?: number;    // 0..1
  boxBorderW?: number;  // pixels
  shadowColor?: string; // e.g. "black"
  shadowAlpha?: number; // 0..1
  shadowX?: number;     // pixels
  shadowY?: number;     // pixels
  enableExpr?: string;  // e.g. "between(t,0,7)"
};

// Build the drawtext filter snippet for the given options.
export function buildDrawText(opts: DrawTextOpts): string {
  const {
    label,
    textFile,
    text,
    fontFile,
    fontSize,
    fontColor,
    xExpr,
    yExpr,
    lineSpacing = 0,
    box = false,
    boxColor = "black",
    boxAlpha = 0.0,
    boxBorderW = 0,
    shadowColor,
    shadowAlpha = 1.0,
    shadowX = 0,
    shadowY = 0,
    enableExpr,
  } = opts;

  const ffFont = toFFPath(fontFile);
  const parts = [
    `fontfile='${ffFont}'`,
    `fontsize=${fontSize}`,
    `fontcolor=${fontColor}`,
    `x=${xExpr}`,
    `y=${yExpr}`,
    `line_spacing=${lineSpacing}`,
    `box=${box ? 1 : 0}`,
    `boxcolor=${boxColor}@${boxAlpha}`,
    `boxborderw=${boxBorderW}`,
  ];
  if (shadowColor) {
    parts.push(`shadowcolor=${shadowColor}@${shadowAlpha}`);
    parts.push(`shadowx=${shadowX}`);
    parts.push(`shadowy=${shadowY}`);
  }
  const common = parts.join(":");

  if (textFile) {
    const ffTxt = toFFPath(textFile);
    return (
      `[${label}_in]drawtext=textfile='${ffTxt}':${common}` +
      (enableExpr ? `:enable='${enableExpr}'` : "") +
      `[${label}]`
    );
  }

  const inline = escTextForDrawText(text ?? "");
  return (
    `[${label}_in]drawtext=text='${inline}':${common}` +
    (enableExpr ? `:enable='${enableExpr}'` : "") +
    `[${label}]`
  );
}

