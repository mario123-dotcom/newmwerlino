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
