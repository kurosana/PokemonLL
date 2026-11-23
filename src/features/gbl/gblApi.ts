export type GblLeague = "little" | "great" | "ultra" | "master";
export type GblResult = "win" | "loss";

export type GblMon = {
  id: number;
  name: string;
  form: string;
};

export type GblMatch = {
  id: string;
  player: string;
  league: GblLeague;
  result: GblResult;
  self: GblMon[];
  opponent: GblMon[];
  recordedAt: string;
};

export async function loadGblMatches(): Promise<GblMatch[]> {
  const response = await fetch("/api/gbl-matches");
  if (!response.ok) throw new Error("記録を読み込めませんでした");
  const body = (await response.json()) as { matches?: GblMatch[] };
  return body.matches ?? [];
}

export async function deleteGblPlayer(player: string, password: string) {
  const response = await fetch("/api/gbl-matches", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player, password }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || "消せませんでした");
}
