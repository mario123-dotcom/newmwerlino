export function ffmpegSafePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/ /g, "\\ ")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

export function ffmpegEscapeExpr(expr: string): string {
  return expr.replace(/,/g, "\\,");
}
