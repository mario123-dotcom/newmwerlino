const { rmSync, existsSync } = require("fs");
const { join } = require("path");

const target = join(process.cwd(), "dist");
if (existsSync(target)) {
  try {
    rmSync(target, { recursive: true, force: true });
    console.log(`[clean] removed ${target}`);
  } catch (err) {
    console.warn(`[clean] unable to remove ${target}:`, err);
  }
}
