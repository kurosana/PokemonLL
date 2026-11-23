import { ADMIN_PASSWORD, parseMatch, seedMatches, withMatch, withoutPlayer } from "./gbl.js";

let memory = {};
let gblMemory = null;

async function readCounts(env) {
  if (env.POKEMON_PICKS) {
    const raw = await env.POKEMON_PICKS.get("counts");
    return raw ? JSON.parse(raw) : {};
  }
  return memory;
}

async function writeCounts(env, counts) {
  if (env.POKEMON_PICKS) {
    await env.POKEMON_PICKS.put("counts", JSON.stringify(counts));
    return;
  }
  memory = counts;
}

const gblCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function gblJson(data, status = 200) {
  return Response.json(data, { status, headers: gblCors });
}

async function readGbl(env) {
  if (env.GBL_MATCHES) {
    const raw = await env.GBL_MATCHES.get("matches");
    if (raw) return JSON.parse(raw);
    const seed = seedMatches();
    await env.GBL_MATCHES.put("matches", JSON.stringify(seed));
    return seed;
  }
  if (!gblMemory) gblMemory = seedMatches();
  return gblMemory;
}

async function writeGbl(env, matches) {
  if (env.GBL_MATCHES) {
    await env.GBL_MATCHES.put("matches", JSON.stringify(matches));
    return;
  }
  gblMemory = matches;
}

async function handleGbl(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: gblCors });
  if (request.method === "GET") {
    const matches = await readGbl(env);
    return gblJson({ matches });
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    const parsed = parseMatch(body);
    if (parsed.error) return gblJson({ error: parsed.error }, 400);
    const current = await readGbl(env);
    const saved = withMatch(current, parsed.match);
    if (saved.created) await writeGbl(env, saved.matches);
    return gblJson({ match: saved.match, created: saved.created }, saved.created ? 201 : 200);
  }
  if (request.method === "DELETE") {
    const body = await request.json().catch(() => ({}));
    if (body.password !== ADMIN_PASSWORD) return gblJson({ error: "パスワードが違います" }, 401);
    const current = await readGbl(env);
    const removed = withoutPlayer(current, body.player);
    if (removed.error) return gblJson({ error: removed.error }, removed.status ?? 400);
    await writeGbl(env, removed.matches);
    return gblJson({ player: removed.name, removed: removed.removed });
  }
  return gblJson({ error: "method" }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/gbl-matches") return handleGbl(request, env);
    if (url.pathname === "/api/pokemon-picks") {
      if (request.method === "GET") {
        return Response.json(await readCounts(env));
      }
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = String(body.id ?? "");
        if (!/^[\w:.-]+$/.test(id) || id.length > 96) {
          return new Response("bad id", { status: 400 });
        }
        const counts = await readCounts(env);
        counts[id] = (counts[id] || 0) + 1;
        await writeCounts(env, counts);
        return Response.json(counts);
      }
      return new Response("method", { status: 405 });
    }
    return env.ASSETS.fetch(request);
  },
};
