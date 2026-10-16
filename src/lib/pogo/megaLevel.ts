import type { PvpMove } from "./combat";

export const MEGA_LEVELS = [1, 2, 3, 4] as const;

export type MegaLevel = (typeof MEGA_LEVELS)[number];

/** サードアタックの威力だけにかける。ゲージ消費は変えない。 */
export function megaLevelMultiplier(level: number) {
  if (level === 2) return 1.1;
  if (level === 3) return 1.2;
  if (level === 4) return 1.3;
  return 1;
}

export function readMegaLevel(value: string): MegaLevel {
  const level = Number(value);
  if (level === 2 || level === 3 || level === 4) return level;
  return 1;
}

export function scaleThirdAttack(move: PvpMove, level: number): PvpMove {
  return { ...move, power: move.power * megaLevelMultiplier(level) };
}
