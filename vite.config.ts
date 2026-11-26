import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { htmlEntry } from "./scripts/htmlEntry.ts";
import { runtimeConfig } from "./scripts/renderRuntimeConfig.ts";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeConfig(),
    visualizer({
      open: process.env.NODE_ENV !== "CI",
      filename: "./dist/stats.html",
    }),
    htmlEntry("src/main.tsx"),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // config.js is rewritten at deploy time: a precached copy would go stale.
        globIgnores: ["**/node_modules/**/*", "config.js"],
        // It blocks the app's startup: on a stalled network, fall back to the
        // cached copy instead of waiting for the request to fail.
        runtimeCaching: [
          {
            urlPattern: /\/config\.js$/,
            handler: "NetworkFirst",
            options: { networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  // Cloudflare Pages serves the site from the root of crm.kigazi.com. A
  // relative base would resolve assets against the current path, so keep it
  // absolute here (a sub-path deployment must pass --base=./ to vite build).
  base: "/",
  build: {
    // Must match the "Build output directory" of the Pages project.
    outDir: "dist",
    rolldownOptions: {
      output: {
        keepNames: true,
      },
    },
    sourcemap: true,
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ["react-router", "react-router-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
