import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const PYODIDE_FILES = [
  "pyodide.asm.js",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
  "pyodide.mjs",
  "pyodide.js",
];

/**
 * Copies the Pyodide runtime (CPython compiled to WebAssembly) from node_modules
 * into public/pyodide so the Python Laboratory works offline and without any CDN.
 * The files are large (~14MB) and gitignored; they are regenerated on every dev/build.
 */
function pyodideAssets(): Plugin {
  return {
    name: "opsforge-pyodide-assets",
    buildStart() {
      const src = path.dirname(require.resolve("pyodide/package.json"));
      const dest = path.resolve("public/pyodide");
      mkdirSync(dest, { recursive: true });
      for (const f of PYODIDE_FILES) {
        const from = path.join(src, f);
        if (existsSync(from)) copyFileSync(from, path.join(dest, f));
      }
    },
  };
}

// GitHub Pages serves the site under /<repo>/, so the base path is injected by CI.
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), pyodideAssets()],
  optimizeDeps: { exclude: ["pyodide"] },
  worker: { format: "es" },
  server: {
    proxy: {
      // Optional coaching proxy (server/index.ts). Only used when enabled in Settings.
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
