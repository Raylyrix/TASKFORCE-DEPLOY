import { defineConfig } from "tsup";

const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  entry: {
    "background/index": "src/background/index.ts",
    "content/index": "src/content/index.tsx",
    "options/index": "src/options/index.tsx",
    "popup/index": "src/popup/index.tsx",
  },
  format: ["esm"],
  target: "es2020",
  outDir: "dist",
  sourcemap: isDev,
  minify: !isDev,
  splitting: false,
  clean: false,
  dts: false,
  platform: "browser",
  noExternal: [
    "react",
    "react-dom",
    "@tanstack/react-query",
    "zustand",
    "zod",
    "date-fns"
  ],
  define: {
    __DEV__: JSON.stringify(isDev),
  },
});


