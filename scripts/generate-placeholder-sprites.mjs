import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlaceholderDotSpriteSvg } from "./placeholder-dot-sprite.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const statsPath = path.join(projectRoot, "public/data/pokemon_stats.json");
const outDir = path.join(projectRoot, "public/assets/pokemon/dot");

const stats = JSON.parse(await fs.readFile(statsPath, "utf8"));
const ids = [...new Set(stats.map((entry) => entry.pokemon_id))].sort((a, b) => a - b);

await fs.mkdir(outDir, { recursive: true });

let written = 0;
for (const id of ids) {
  const fileName = `${String(id).padStart(4, "0")}.svg`;
  const svg = buildPlaceholderDotSpriteSvg(id);
  await fs.writeFile(path.join(outDir, fileName), svg, "utf8");
  written += 1;
}

console.log(`Wrote ${written} placeholder sprites to ${outDir}`);
