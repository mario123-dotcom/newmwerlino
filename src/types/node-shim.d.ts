declare module "fs";
declare module "path";
declare module "http";
declare module "https";
declare module "zlib";
declare module "node:zlib";
declare module "child_process";
declare module "node:test";
declare module "node:assert/strict";

declare const process: any;
declare function require(name: string): any;

type Buffer = any;
declare const Buffer: any;
