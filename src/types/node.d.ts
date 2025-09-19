declare module "fs" {
  const fs: any;
  export = fs;
}

declare module "path" {
  const path: any;
  export = path;
}

declare module "http" {
  const http: any;
  export = http;
}

declare module "https" {
  const https: any;
  export = https;
}

declare module "zlib" {
  const zlib: any;
  export = zlib;
}

declare module "node:test" {
  const nodeTest: any;
  export = nodeTest;
}

declare module "node:assert/strict" {
  const nodeAssert: any;
  export = nodeAssert;
}

declare const process: any;

interface Console {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

declare const console: Console;

declare class Buffer extends Uint8Array {
  static from(data: any, encoding?: string): Buffer;
  static concat(list: readonly Buffer[], totalLength?: number): Buffer;
  toString(encoding?: string): string;
  readonly length: number;
}
