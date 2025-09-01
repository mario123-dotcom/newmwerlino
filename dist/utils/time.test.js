"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const time_1 = require("./time");
(0, node_test_1.default)('parseSec parses numbers from strings and falls back to default', () => {
    strict_1.default.strictEqual((0, time_1.parseSec)('1.5s'), 1.5);
    strict_1.default.strictEqual((0, time_1.parseSec)('3,5'), 3.5);
    strict_1.default.strictEqual((0, time_1.parseSec)('foo', 2), 2);
    strict_1.default.strictEqual((0, time_1.parseSec)(4), 4);
});
(0, node_test_1.default)('lineOffset applies stagger and clamps within segment duration', () => {
    strict_1.default.strictEqual((0, time_1.lineOffset)(2, 10, 2), 0.287);
    strict_1.default.strictEqual((0, time_1.lineOffset)(0, 1, 2), 0);
});
