/**
 * 対戦の細かい仕様は docs/対戦仕様.md。
 * このファイルを直す前に、その文書を読む。連戦モードでも同じ順で処理する。
 */
import { damageForMove, type PvpMove } from "./combat";

export type ChargeTiming = "asap" | "cct";
export type FighterId = "a" | "b";

export type FighterInput = {
  label: string;
  attack: number;
  defense: number;
  hp: number;
  types: string[];
  shadow: boolean;
  fast: PvpMove;
  charged: PvpMove[];
  shields: number;
  timing: ChargeTiming;
  applyChanceBuffs: boolean;
  /** 指定ターンに交代する。出てきたポケモンはそのターン技を出さない。シールドは引き継ぐ。 */
  switchPlan?: SwitchPlan | null;
};

export type SwitchPlan = {
  turn: number;
  next: {
    label: string;
    attack: number;
    defense: number;
    hp: number;
    types: string[];
    shadow: boolean;
    fast: PvpMove;
    charged: PvpMove[];
  };
};

export type TimelineEvent = {
  turn: number;
  actor: FighterId;
  kind: "fast" | "charged";
  moveName: string;
  moveType: string;
  damage: number;
  shielded: boolean;
  actionId: number;
  hpA: number;
  hpB: number;
  energyA: number;
  energyB: number;
};

export type SimResult = {
  winner: FighterId | "draw";
  turns: number;
  hpA: number;
  hpB: number;
  maxHpA: number;
  maxHpB: number;
  rating: number;
  timeline: TimelineEvent[];
};

type Action = {
  kind: "fast" | "charged";
  move: PvpMove;
  turnsLeft: number;
  totalTurns: number;
  id: number;
  startTurn: number;
};

type FighterState = FighterInput & {
  id: FighterId;
  energy: number;
  shieldsLeft: number;
  attackStage: number;
  defenseStage: number;
  action: Action | null;
};

function clampStage(value: number) {
  return Math.max(-4, Math.min(4, value));
}

function cctTurnsLeft(myTurns: number, oppTurns: number) {
  if (oppTurns <= 1) return null;
  const key = `${myTurns}-${oppTurns}`;
  const table: Record<string, number | null> = {
    "1-2": 1,
    "1-3": 1,
    "1-4": 1,
    "2-2": null,
    "2-3": 1,
    "2-4": 2,
    "3-2": 1,
    "3-3": null,
    "3-4": 1,
    "4-2": null,
    "4-3": 1,
    "4-4": null,
  };
  return table[key] ?? null;
}

function snapshot(a: FighterState, b: FighterState) {
  return {
    hpA: Math.max(0, a.hp),
    hpB: Math.max(0, b.hp),
    energyA: a.energy,
    energyB: b.energy,
  };
}

function damageOf(self: FighterState, other: FighterState, move: PvpMove) {
  return damageForMove(
    move,
    self.attack,
    other.defense,
    self.types,
    other.types,
    self.shadow,
    other.shadow,
    self.attackStage,
    other.defenseStage,
  );
}

function pickCharged(self: FighterState, other: FighterState) {
  const ready = self.charged.filter((move) => self.energy >= move.energy);
  if (!ready.length) return null;

  const koUnshielded = ready.find((move) => damageOf(self, other, move) >= other.hp && other.shieldsLeft === 0);
  if (koUnshielded) return koUnshielded;

  const bait = self.charged[1];
  if (other.shieldsLeft > 0 && bait && self.energy >= bait.energy) return bait;
  return ready[0];
}

function shouldThrow(self: FighterState, other: FighterState, move: PvpMove) {
  if (other.shieldsLeft === 0 && damageOf(self, other, move) >= other.hp) return true;
  if (self.timing === "asap") return true;

  const needed = cctTurnsLeft(self.fast.turns, other.fast.turns);
  if (needed == null) return true;
  if (other.action?.kind === "fast" && other.action.turnsLeft === needed) return true;
  return false;
}

function applyBuffs(self: FighterState, other: FighterState, move: PvpMove, forceChance: boolean) {
  if (!move.buffs) return;
  const chance = move.buffChance ?? 1;
  if (chance < 1 && !forceChance) return;

  const [atk, def] = move.buffs;
  const target = move.buffTarget ?? "self";
  const apply = (fighter: FighterState) => {
    fighter.attackStage = clampStage(fighter.attackStage + atk);
    fighter.defenseStage = clampStage(fighter.defenseStage + def);
  };

  if (target === "self" || target === "both") apply(self);
  if (target === "opponent" || target === "both") apply(other);
}

function cmpAttack(fighter: FighterState) {
  return fighter.attack * (fighter.shadow ? 1.2 : 1);
}

function chargeOrder(fighters: FighterState[]) {
  return [...fighters].sort((left, right) => {
    const diff = cmpAttack(right) - cmpAttack(left);
    if (diff !== 0) return diff;
    return Math.random() < 0.5 ? -1 : 1;
  });
}

function applySwitch(fighter: FighterState, next: SwitchPlan["next"]) {
  const shieldsLeft = fighter.shieldsLeft;
  const id = fighter.id;
  const timing = fighter.timing;
  const applyChanceBuffs = fighter.applyChanceBuffs;
  const shields = fighter.shields;
  Object.assign(fighter, {
    ...next,
    id,
    shields,
    shieldsLeft,
    timing,
    applyChanceBuffs,
    switchPlan: null,
    energy: 0,
    attackStage: 0,
    defenseStage: 0,
    action: null,
    hp: next.hp,
  });
}

function createFighter(id: FighterId, input: FighterInput): FighterState {
  return {
    ...input,
    id,
    hp: input.hp,
    energy: 0,
    shieldsLeft: input.shields,
    attackStage: 0,
    defenseStage: 0,
    action: null,
  };
}

type MoveCell = {
  moveA: PvpMove | null;
  moveB: PvpMove | null;
  result: SimResult;
};

/**
 * 両方にスペシャルアタックが2つあるときは、勝つ側は倒すのが一番早い技、
 * 負ける側は負けるまでに相手のHPを一番削る技を、組み合わせの中から一度だけ選ぶ。
 * 選び直して勝敗が入れ替わるループには入らない。選んだ結果が引き分けなら引き分けのまま返す。
 */
export function simulateBattle(inputA: FighterInput, inputB: FighterInput): SimResult {
  if (inputA.charged.length <= 1 && inputB.charged.length <= 1) {
    return simulateLocked(inputA, inputB);
  }

  const optionsA = inputA.charged.length ? inputA.charged : [null];
  const optionsB = inputB.charged.length ? inputB.charged : [null];
  const cells: MoveCell[] = [];
  for (const moveA of optionsA) {
    for (const moveB of optionsB) {
      cells.push({
        moveA,
        moveB,
        result: simulateLocked(
          { ...inputA, charged: moveA ? [moveA] : [] },
          { ...inputB, charged: moveB ? [moveB] : [] },
        ),
      });
    }
  }
  return pickChargedCell(cells).result;
}

function pickChargedCell(cells: MoveCell[]) {
  const winsA = cells.filter((cell) => cell.result.winner === "a");
  const winsB = cells.filter((cell) => cell.result.winner === "b");
  const draws = cells.filter((cell) => cell.result.winner === "draw");
  if (!winsA.length && !winsB.length) return draws[0] ?? cells[0];

  let winnerId: FighterId;
  if (winsA.length && !winsB.length) winnerId = "a";
  else if (winsB.length && !winsA.length) winnerId = "b";
  else {
    const bestA = Math.min(...winsA.map((cell) => cell.result.turns));
    const bestB = Math.min(...winsB.map((cell) => cell.result.turns));
    if (bestA === bestB) return closestCell(draws.length ? draws : cells);
    winnerId = bestA < bestB ? "a" : "b";
  }

  const winCells = winnerId === "a" ? winsA : winsB;
  const fastest = Math.min(...winCells.map((cell) => cell.result.turns));
  const fastestCells = winCells.filter((cell) => cell.result.turns === fastest);
  const winCell = fastestCells.reduce((best, cell) => (winnerHp(cell, winnerId) > winnerHp(best, winnerId) ? cell : best));
  const winMove = winnerId === "a" ? winCell.moveA : winCell.moveB;
  const against = cells.filter((cell) => (winnerId === "a" ? cell.moveA === winMove : cell.moveB === winMove));
  const losses = against.filter((cell) => cell.result.winner === winnerId);
  const pool = losses.length ? losses : against;
  return pool.reduce((best, cell) => {
    const dealt = damageByLoser(cell, winnerId);
    const bestDealt = damageByLoser(best, winnerId);
    if (dealt !== bestDealt) return dealt > bestDealt ? cell : best;
    return cell.result.turns > best.result.turns ? cell : best;
  });
}

function winnerHp(cell: MoveCell, winnerId: FighterId) {
  return winnerId === "a" ? cell.result.hpA : cell.result.hpB;
}

function damageByLoser(cell: MoveCell, winnerId: FighterId) {
  return winnerId === "a" ? cell.result.maxHpA - cell.result.hpA : cell.result.maxHpB - cell.result.hpB;
}

function closestCell(cells: MoveCell[]) {
  return cells.reduce((best, cell) => {
    const gap = Math.abs(cell.result.hpA - cell.result.hpB);
    const bestGap = Math.abs(best.result.hpA - best.result.hpB);
    return gap < bestGap ? cell : best;
  });
}

function simulateLocked(inputA: FighterInput, inputB: FighterInput): SimResult {
  const a = createFighter("a", inputA);
  const b = createFighter("b", inputB);
  const maxHpA = inputA.hp;
  const maxHpB = inputB.hp;
  const timeline: TimelineEvent[] = [];
  let nextActionId = 1;

  for (let turn = 1; turn <= 480; turn += 1) {
    for (const [self, other] of [
      [a, b],
      [b, a],
    ] as const) {
      if (self.hp <= 0) continue;
      if (self.switchPlan?.turn === turn) {
        self.action = null;
        continue;
      }
      if (self.action) continue;
      const charged = pickCharged(self, other);
      if (charged && shouldThrow(self, other, charged)) {
        self.action = { kind: "charged", move: charged, turnsLeft: 1, totalTurns: 1, id: nextActionId++, startTurn: turn };
      } else {
        const turns = Math.max(1, self.fast.turns);
        self.action = {
          kind: "fast",
          move: self.fast,
          turnsLeft: turns,
          totalTurns: turns,
          id: nextActionId++,
          startTurn: turn,
        };
      }
    }

    const occupied = [a, b].map((fighter) => ({ fighter, action: fighter.action }));
    const dealt: Record<FighterId, { damage: number; shielded: boolean }> = {
      a: { damage: 0, shielded: false },
      b: { damage: 0, shielded: false },
    };

    // 1. 交代。1ターンを使い、出てきたポケモンはこのターン技を出さない。
    for (const fighter of [a, b]) {
      if (fighter.hp <= 0 || fighter.switchPlan?.turn !== turn) continue;
      applySwitch(fighter, fighter.switchPlan.next);
    }

    // 2. スペシャルアタック。攻撃実数値が高い順。同値ならランダム。1発ごとに戦闘不能を見る。
    const chargers = chargeOrder([a, b].filter((fighter) => fighter.action?.kind === "charged" && fighter.hp > 0));
    const resolved = new Set<number>();
    let faintedFromSpecial = false;
    let specialLanded = false;
    for (const self of chargers) {
      const other = self.id === "a" ? b : a;
      const action = self.action;
      if (!action || self.hp <= 0 || other.hp <= 0) {
        self.action = null;
        continue;
      }
      self.energy = Math.max(0, self.energy - action.move.energy);
      let damage = 0;
      let shielded = false;
      if (other.shieldsLeft > 0) {
        other.shieldsLeft -= 1;
        damage = 1;
        shielded = true;
      } else {
        damage = damageOf(self, other, action.move);
      }
      other.hp -= damage;
      applyBuffs(self, other, action.move, self.applyChanceBuffs);
      dealt[self.id] = { damage, shielded };
      resolved.add(action.id);
      self.action = null;
      specialLanded = true;
      if (a.hp <= 0 || b.hp <= 0) {
        faintedFromSpecial = true;
        break;
      }
    }

    // 3. スペシャルで戦闘不能なら、残りのノーマルアタックはダメージもチャージも無しで打ち切る。
    if (faintedFromSpecial) {
      for (const fighter of [a, b]) {
        if (fighter.action) fighter.action = null;
      }
    } else {
      // 4. 最終ターンのノーマルアタックだけ、ダメージとチャージを入れる。
      //    このターンにスペシャルがあった技は、最終ターンまで進めてから処理する。
      const finishing: FighterState[] = [];
      for (const fighter of [a, b]) {
        if (fighter.action?.kind !== "fast" || fighter.hp <= 0) continue;
        fighter.action.turnsLeft -= 1;
        if (specialLanded && fighter.action.turnsLeft > 0) fighter.action.turnsLeft = 0;
        if (fighter.action.turnsLeft <= 0) finishing.push(fighter);
      }
      for (const self of finishing) {
        const other = self.id === "a" ? b : a;
        const action = self.action;
        if (!action) continue;
        self.energy = Math.min(100, self.energy + action.move.energyGain);
        const damage = damageOf(self, other, action.move);
        other.hp -= damage;
        dealt[self.id] = { damage, shielded: false };
        self.action = null;
      }
    }

    const snap = snapshot(a, b);
    for (const { fighter, action } of occupied) {
      if (!action) continue;
      if (action.kind === "charged" && !resolved.has(action.id)) continue;
      timeline.push({
        turn,
        actor: fighter.id,
        kind: action.kind,
        moveName: action.move.name,
        moveType: action.move.type,
        damage: dealt[fighter.id].damage,
        shielded: dealt[fighter.id].shielded,
        actionId: action.id,
        ...snap,
      });
    }

    if (a.hp <= 0 || b.hp <= 0) {
      const winner = a.hp <= 0 && b.hp <= 0 ? "draw" : a.hp > 0 ? "a" : "b";
      const rating =
        winner === "draw"
          ? 100
          : winner === "a"
            ? 100 + Math.round((100 * Math.max(0, a.hp)) / maxHpA)
            : 100 - Math.round((100 * Math.max(0, b.hp)) / maxHpB);
      return {
        winner,
        turns: turn,
        hpA: Math.max(0, a.hp),
        hpB: Math.max(0, b.hp),
        maxHpA,
        maxHpB,
        rating,
        timeline,
      };
    }
  }

  return {
    winner: "draw",
    turns: 480,
    hpA: Math.max(0, a.hp),
    hpB: Math.max(0, b.hp),
    maxHpA,
    maxHpB,
    rating: 100,
    timeline,
  };
}

export function simulateShieldGrid(inputA: FighterInput, inputB: FighterInput) {
  const grid: SimResult[][] = [];
  for (let shieldsA = 0; shieldsA <= 2; shieldsA += 1) {
    const row: SimResult[] = [];
    for (let shieldsB = 0; shieldsB <= 2; shieldsB += 1) {
      row.push(simulateBattle({ ...inputA, shields: shieldsA }, { ...inputB, shields: shieldsB }));
    }
    grid.push(row);
  }
  return grid;
}
