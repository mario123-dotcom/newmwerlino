"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapParagraph = wrapParagraph;
exports.normalizeQuotes = normalizeQuotes;
exports.escDrawText = escDrawText;
function wrapParagraph(text, width = 30) {
    const words = String(text ?? "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = [];
    for (const w of words) {
        const test = [...line, w].join(" ");
        if (test.length > width && line.length) {
            lines.push(line.join(" "));
            line = [w];
        }
        else
            line.push(w);
    }
    if (line.length)
        lines.push(line.join(" "));
    return lines.length ? lines : [""];
}
function normalizeQuotes(s) { return String(s).replace(/'/g, "’"); }
function escDrawText(s) { return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'"); }
