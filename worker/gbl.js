/** 管理者ログインと、記録削除APIが同じ合言葉を見る。 */
export const ADMIN_PASSWORD = "cham2riverE";

const LEAGUE_ALIAS = {
  little: "little",
  littile: "little",
  リトル: "little",
  リトルカップ: "little",
  great: "great",
  super: "great",
  スーパー: "great",
  スーパーリーグ: "great",
  ultra: "ultra",
  hyper: "ultra",
  ハイパー: "ultra",
  ハイパーリーグ: "ultra",
  master: "master",
  マスター: "master",
  マスターリーグ: "master",
};

const RESULT_ALIAS = {
  win: "win",
  w: "win",
  true: "win",
  勝: "win",
  勝ち: "win",
  loss: "loss",
  lose: "loss",
  l: "loss",
  false: "loss",
  負: "loss",
  負け: "loss",
};

function mon(id, name) {
  return { id, name, form: "Normal" };
}

/** 画面確認用。保存が空のときだけ返す。 */
export function seedMatches() {
  const at = (minute) => new Date(Date.UTC(2026, 10, 22, 1, minute, 0)).toISOString();
  const row = (id, league, result, self, opponent, minute) => ({
    id,
    clientId: id,
    player: "dummy",
    league,
    result,
    self,
    opponent,
    recordedAt: at(minute),
  });
  return [
    row(
      "seed-dummy-1",
      "great",
      "win",
      [mon(376, "メタグロス"), mon(149, "カイリュー"), mon(184, "マリルリ")],
      [mon(379, "レジスチル"), mon(3, "フシギバナ"), mon(445, "ガブリアス")],
      10,
    ),
    row(
      "seed-dummy-2",
      "great",
      "loss",
      [mon(208, "ハガネール"), mon(245, "スイクン"), mon(227, "エアームド")],
      [mon(260, "ラグラージ"), mon(468, "トゲキッス"), mon(36, "ピクシー")],
      20,
    ),
    row(
      "seed-dummy-3",
      "great",
      "win",
      [mon(809, "メルメタル"), mon(706, "ヌメルゴン"), mon(748, "ドヒドイデ")],
      [mon(68, "カイリキー"), mon(143, "カビゴン"), mon(233, "ポリゴン2")],
      30,
    ),
    row(
      "seed-dummy-4",
      "little",
      "loss",
      [mon(89, "ベトベトン"), mon(183, "マリル"), mon(313, "バルビート")],
      [mon(355, "ヨマワル"), mon(39, "プリン"), mon(74, "イシツブテ")],
      40,
    ),
    row(
      "seed-dummy-5",
      "ultra",
      "win",
      [mon(487, "ギラティナ"), mon(483, "ディアルガ"), mon(484, "パルキア")],
      [mon(644, "ゼクロム"), mon(643, "レシラム"), mon(150, "ミュウツー")],
      50,
    ),
  ];
}

export function cleanPlayerName(value) {
  const name = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name || name.length > 24) return "";
  if (/[\u0000-\u001f]/.test(name)) return "";
  return name;
}

function parseMon(value) {
  if (!value || typeof value !== "object") return null;
  const id = Number(value.id);
  if (!Number.isInteger(id) || id < 1 || id > 2000) return null;
  const name = String(value.name ?? "").trim();
  if (!name || name.length > 24 || /[\u0000-\u001f]/.test(name)) return null;
  const form = String(value.form ?? "Normal").trim() || "Normal";
  if (form.length > 32 || /[\u0000-\u001f]/.test(form)) return null;
  return { id, name, form };
}

function parseParty(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const party = value.map(parseMon);
  if (party.some((item) => !item)) return null;
  return party;
}

function cleanClientId(value) {
  const id = String(value ?? "").trim();
  if (!id) return "";
  if (id.length > 80 || !/^[\w:.-]+$/.test(id)) return null;
  return id;
}

/** アプリからの1件を、保存できる形にする。失敗時は error。 */
export function parseMatch(body, now = new Date()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "jsonが必要です" };
  const player = cleanPlayerName(body.player);
  if (!player) return { error: "プレイヤー名がありません" };
  const league = LEAGUE_ALIAS[String(body.league ?? "").trim()];
  if (!league) return { error: "リーグは little / great / ultra / master です" };
  const resultKey = String(body.result ?? "").trim();
  const result = RESULT_ALIAS[resultKey] || RESULT_ALIAS[resultKey.toLowerCase()];
  if (!result) return { error: "勝ち負けは win か loss です" };
  const self = parseParty(body.self);
  const opponent = parseParty(body.opponent);
  if (!self || !opponent) return { error: "自分と相手は、ポケモン3体ずつです" };
  const clientId = cleanClientId(body.clientId);
  if (clientId == null) return { error: "clientId の形が違います" };
  return {
    match: {
      id: crypto.randomUUID(),
      clientId,
      player,
      league,
      result,
      self,
      opponent,
      recordedAt: now.toISOString(),
    },
  };
}

export function playersOf(matches) {
  const counts = new Map();
  for (const row of matches) counts.set(row.player, (counts.get(row.player) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([name, count]) => ({ name, count }));
}

/** 同じ clientId が既にあれば足さない。 */
export function withMatch(matches, match) {
  if (match.clientId) {
    const existing = matches.find((row) => row.clientId === match.clientId && row.player === match.player);
    if (existing) return { matches, created: false, match: existing };
  }
  return { matches: [match, ...matches].slice(0, 2000), created: true, match };
}

export function withoutPlayer(matches, player) {
  const name = cleanPlayerName(player);
  if (!name) return { error: "プレイヤー名がありません" };
  const next = matches.filter((row) => row.player !== name);
  if (next.length === matches.length) return { error: "そのプレイヤーの記録はありません", status: 404 };
  return { matches: next, removed: matches.length - next.length, name };
}
