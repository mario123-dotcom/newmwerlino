"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const text_1 = require("./text");
(0, node_test_1.default)('wrapParagraph breaks text into lines respecting width', () => {
    strict_1.default.deepStrictEqual((0, text_1.wrapParagraph)('uno due tre', 7), ['uno due', 'tre']);
});
(0, node_test_1.default)('wrapParagraph handles empty input', () => {
    strict_1.default.deepStrictEqual((0, text_1.wrapParagraph)('', 5), ['']);
});
(0, node_test_1.default)('normalizeQuotes replaces apostrophes with curly quotes', () => {
    strict_1.default.strictEqual((0, text_1.normalizeQuotes)("l'auto"), 'l’auto');
});
(0, node_test_1.default)('escDrawText doubles backslashes', () => {
    strict_1.default.strictEqual((0, text_1.escDrawText)('\\'), '\\\\');
});
(0, node_test_1.default)('escDrawText escapes colons', () => {
    strict_1.default.strictEqual((0, text_1.escDrawText)(':'), '\\:');
});
(0, node_test_1.default)("escDrawText escapes single quotes", () => {
    strict_1.default.strictEqual((0, text_1.escDrawText)("'"), "\\'");
});
