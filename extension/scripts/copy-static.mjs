import { cp, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const sourceDir = resolve(root, "public");
const destinationDir = resolve(root, "dist");

try {
  await access(sourceDir, constants.F_OK);
  await mkdir(destinationDir, { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });
  console.log(`[copy-static] Copied assets from ${sourceDir} to ${destinationDir}`);
} catch (error) {
  console.error("[copy-static] Failed to copy static assets", error);
  process.exit(1);
}


