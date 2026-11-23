import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { ADMIN_PASSWORD, parseMatch, seedMatches, withMatch, withoutPlayer } from "./worker/gbl.js";
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

function pokemonPickCounts(): Plugin {
  const file = path.join(projectRoot, "work/pokemon-pick-counts.json");
  const read = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, number>;
    } catch {
      return {};
    }
  };
  const write = (counts: Record<string, number>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(counts));
  };

  return {
    name: "pokemon-pick-counts",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/api/pokemon-picks") return next();
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(read()));
          return;
        }
        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          req.on("end", () => {
            const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as { id?: number | string };
            const id = String(body.id ?? "");
            if (!/^[\w:.-]+$/.test(id) || id.length > 96) {
              res.statusCode = 400;
              res.end("bad id");
              return;
            }
            const counts = read();
            counts[id] = (counts[id] ?? 0) + 1;
            write(counts);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(counts));
          });
          return;
        }
        next();
      });
    },
  };
}

function gblMatches(): Plugin {
  const file = path.join(projectRoot, "work/gbl-matches.json");
  let cache: ReturnType<typeof seedMatches> | null = null;
  const read = () => {
    if (cache) return cache;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(parsed)) {
        cache = parsed;
        return cache;
      }
    } catch {
      /* まだファイルが無いときはダミーを見せる */
    }
    cache = seedMatches();
    return cache;
  };
  const write = (matches: ReturnType<typeof seedMatches>) => {
    cache = matches;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(matches));
  };
  const send = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(body));
  };

  return {
    name: "gbl-matches",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/api/gbl-matches") return next();
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }
        if (req.method === "GET") {
          send(res, 200, { matches: read() });
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          const body = JSON.parse(Buffer.concat(chunks).toString() || "null");
          if (req.method === "POST") {
            const parsed = parseMatch(body);
            if (parsed.error || !parsed.match) {
              send(res, 400, { error: parsed.error ?? "jsonが必要です" });
              return;
            }
            const saved = withMatch(read(), parsed.match);
            if (saved.created) write(saved.matches);
            send(res, saved.created ? 201 : 200, { match: saved.match, created: saved.created });
            return;
          }
          if (req.method === "DELETE") {
            if (body?.password !== ADMIN_PASSWORD) {
              send(res, 401, { error: "パスワードが違います" });
              return;
            }
            const removed = withoutPlayer(read(), body?.player);
            if (removed.error || !removed.matches) {
              send(res, removed.status ?? 400, { error: removed.error });
              return;
            }
            write(removed.matches);
            send(res, 200, { player: removed.name, removed: removed.removed });
            return;
          }
          next();
        });
      });
    },
  };
}

function rootImageDir(): Plugin {
  let clientOutDir = path.join(projectRoot, "dist", "client");
  return {
    name: "root-image-dir",
    configResolved(config) {
      const fromClient = config.environments?.client?.build?.outDir;
      if (fromClient) clientOutDir = path.resolve(config.root, fromClient);
    },
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
      const dest = path.join(clientOutDir, "Image");
      fs.mkdirSync(clientOutDir, { recursive: true });
      fs.cpSync(imageRoot, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflare(), rootImageDir(), pokemonPickCounts(), gblMatches()],
  build: {
    outDir: "dist",
  },
});
