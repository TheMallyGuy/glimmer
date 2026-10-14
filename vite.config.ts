import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type UserConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { intlayer } from "vite-intlayer";
import process from "node:process";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig((): UserConfig => ({
  // intlayer goes before sveltekit so content declarations are built first
  plugins: [tailwindcss(), intlayer(), sveltekit()],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,

  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // intlayer's generated dictionaries live outside src
    fs: { allow: [resolve("./.intlayer")] },
    host: host || "127.0.0.1",
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: [
        // 3. tell Vite to ignore watching `src-tauri`
        "**/src-tauri/**",
        "**/*.crdownload",
        "**/*.tmp",
        "**/Unconfirmed*",
      ]
    }
  },
  // the webviews (WebView2, Android System WebView) are current, so nothing is transpiled down, and the
  // bundle is minified with Oxc (JS) and Lightning CSS (CSS) with no sourcemaps and no modulepreload polyfill
  build: {
    target: "esnext",
    minify: "oxc",
    cssMinify: "lightningcss",
    sourcemap: false,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
  },
  resolve: {
    alias: {
      $lib: resolve("./src/lib"),
      $ts: resolve("./src/ts"),

    }
  }
}));
