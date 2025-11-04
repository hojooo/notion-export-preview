import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "@samrum/vite-plugin-web-extension";
import { resolve } from "path";
import pkg from "./package.json";

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: {
        name: "Notion Export Preview",
        description: pkg.description,
        version: pkg.version,
        manifest_version: 3,
        permissions: ["downloads", "scripting", "activeTab", "storage", "offscreen", "cookies"],
        host_permissions: [
          "https://www.notion.so/*"
        ],
        background: {
          service_worker: "src/background/serviceWorker.ts",
          type: "module",
        },
        action: {
          default_popup: "src/popup/index.html",
          default_title: "Notion Export Preview",
        },
        content_scripts: [
          {
            matches: ["https://*.notion.so/*"],
            js: ["src/content/index.ts"],
            run_at: "document_end",
          },
        ],
      },
      additionalInputs: {
        html: ["src/viewer/index.html", "src/offscreen/index.html"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,     // 개발 모드: console.log 유지
        drop_debugger: true,     // debugger 구문 제거
      }
    },
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
