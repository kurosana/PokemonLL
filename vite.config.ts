import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const imageRoot = path.join(projectRoot, "Image");

const mimeByExt: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function rootImageDir(): Plugin {
  return {
    name: "root-image-dir",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/Image/")) return next();
        const relative = decodeURIComponent(url.slice("/Image/".length));
        const filePath = path.resolve(imageRoot, relative);
        if (!filePath.startsWith(imageRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", mimeByExt[ext] ?? "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      if (!fs.existsSync(imageRoot)) return;
      const outDir = path.join(projectRoot, "dist", "Image");
      fs.mkdirSync(path.dirname(outDir), { recursive: true });
      fs.cpSync(imageRoot, outDir, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflare(), rootImageDir()],
  build: {
    outDir: "dist",
  },
});
