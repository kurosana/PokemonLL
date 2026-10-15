import type { PvpMove } from "./combat";

export type MoveBonusEffectLine = {
  chance: string;
  kind: "攻撃" | "防御";
  stage: string;
};

function formatChancePercent(chance: number) {
  const percent = chance * 100;
  if (Number.isInteger(percent)) return `${percent}%`;
  return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
}

function stageArrows(delta: number) {
  const steps = Math.abs(delta);
  if (!steps) return "";
  return delta > 0 ? "↑".repeat(steps) : "↓".repeat(steps);
}

/** 確率・種類・段階だけの行にする。変化が無いときは空配列。 */
export function moveBonusEffectLines(move: PvpMove | null | undefined): MoveBonusEffectLine[] {
  if (!move?.buffs) return [];
  const [attack, defense] = move.buffs;
  const chance = formatChancePercent(move.buffChance ?? 1);
  const lines: MoveBonusEffectLine[] = [];

  const push = (delta: number, kind: "攻撃" | "防御") => {
    const stage = stageArrows(delta);
    if (!stage) return;
    lines.push({ chance, kind, stage });
  };

  push(attack, "攻撃");
  push(defense, "防御");
  return lines;
}
