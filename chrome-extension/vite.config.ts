import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs";

function copyStaticPlugin() {
  return {
    name: "copy-static",
    closeBundle() {
      copyFileSync("manifest.json", "dist/manifest.json");
      const iconsDir = "public/icons";
      const destDir = "dist/icons";
      if (existsSync(iconsDir)) {
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        readdirSync(iconsDir).forEach((f) =>
          copyFileSync(`${iconsDir}/${f}`, `${destDir}/${f}`),
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
        content: resolve(__dirname, "src/content/content.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "content") return "content.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
