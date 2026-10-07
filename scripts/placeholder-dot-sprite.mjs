/**
 * Deterministic 64×64 placeholder dot sprites (8×8 cells, 8px each).
 * Replace files under public/assets/pokemon/dot/ with real art later (same paths).
 */

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbHex([r, g, b]) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** @param {number} pokemonId */
export function buildPlaceholderDotSpriteSvg(pokemonId) {
  const id = Math.max(1, Math.floor(pokemonId));
  const rand = mulberry32(id * 2654435761);
  const hue = (id * 37) % 360;
  const body = rgbHex(hslToRgb(hue, 0.55, 0.52));
  const highlight = rgbHex(hslToRgb((hue + 28) % 360, 0.45, 0.68));
  const shadow = rgbHex(hslToRgb((hue + 200) % 360, 0.4, 0.32));

  const grid = 8;
  const cell = 8;
  const size = 64;
  const parts = [];

  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid / 2; x += 1) {
      const nx = (x - 3.5) / 3.5;
      const ny = (y - 3.5) / 4;
      const filled = nx * nx + ny * ny < 0.85 + rand() * 0.08 && y > 0 && y < grid - 1;
      if (!filled) continue;
      const tone = y < 3 ? highlight : body;
      const xl = x * cell;
      const xr = (grid - 1 - x) * cell;
      const yl = y * cell;
      parts.push(`<rect x="${xl}" y="${yl}" width="${cell}" height="${cell}" fill="${tone}"/>`);
      if (x !== grid - 1 - x) {
        parts.push(`<rect x="${xr}" y="${yl}" width="${cell}" height="${cell}" fill="${tone}"/>`);
      }
    }
  }

  parts.push(`<rect x="16" y="20" width="8" height="8" fill="${shadow}"/>`);
  parts.push(`<rect x="40" y="20" width="8" height="8" fill="${shadow}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${parts.join("")}</svg>`;
}
