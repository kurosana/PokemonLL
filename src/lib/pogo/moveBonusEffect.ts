import type { PvpMove } from "./combat";

function stageLine(delta: number, stat: "攻撃" | "防御", who: string) {
  const steps = Math.abs(delta);
  if (!steps) return null;
  const verb = delta > 0 ? "上げる" : "下げる";
  return `${who}の${stat}を${steps}段階${verb}`;
}

function formatChance(chance: number) {
  if (chance >= 1) return "";
  const percent = chance * 100;
  const text = Number.isInteger(percent) ? String(percent) : percent.toFixed(1).replace(/\.0$/, "");
  return `${text}%の確率で`;
}

/** 技データから、画面用の追加効果説明を作る。変化が無いときは「なし」。 */
export function moveBonusEffectDescription(move: PvpMove | null | undefined) {
  if (!move?.buffs) return "なし";
  const [attack, defense] = move.buffs;
  if (attack === 0 && defense === 0) return "なし";

  const target = move.buffTarget ?? "self";
  const lines: string[] = [];
  const push = (who: string) => {
    const attackLine = stageLine(attack, "攻撃", who);
    const defenseLine = stageLine(defense, "防御", who);
    if (attackLine) lines.push(attackLine);
    if (defenseLine) lines.push(defenseLine);
  };

  if (target === "self") push("自分");
  else if (target === "opponent") push("相手");
  else {
    push("自分");
    push("相手");
  }

  if (!lines.length) return "なし";
  const chance = formatChance(move.buffChance ?? 1);
  return chance ? `${chance}${lines.join("、")}` : lines.join("、");
}
