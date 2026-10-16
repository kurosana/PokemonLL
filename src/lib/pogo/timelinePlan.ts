export type TimelineStep =
  | { kind: "fast"; moveId: string; /** 途中完了したときの実ターン数。未指定は技本来のターン数。 */ turns?: number }
  | { kind: "charged"; moveId: string }
  | { kind: "wait" };

export type StepMark = "ok" | "void" | "short";

export type SideClock = {
  marks: StepMark[];
  fastCounts: (number | null)[];
  effectiveTurns: number[];
};

export type TimelineSpan = {
  stepIndex: number;
  step: TimelineStep;
  startTurn: number;
  turns: number;
};

export function stepDuration(step: TimelineStep, fastTurns: number) {
  if (step.kind === "fast") return Math.max(1, step.turns ?? fastTurns);
  return 1;
}

export function expandPlan(steps: TimelineStep[], fastTurns: number): TimelineSpan[] {
  const spans: TimelineSpan[] = [];
  let turn = 1;
  steps.forEach((step, stepIndex) => {
    const turns = stepDuration(step, fastTurns);
    spans.push({ stepIndex, step, startTurn: turn, turns });
    turn += turns;
  });
  return spans;
}

export function planTurns(steps: TimelineStep[], fastTurns: number) {
  return steps.reduce((sum, step) => sum + stepDuration(step, fastTurns), 0);
}

/** 1始まりのターンが、どの手順の何ターン目か。範囲外は null。 */
export function locateTurn(steps: TimelineStep[], fastTurns: number, turn: number) {
  let cursor = 1;
  for (let index = 0; index < steps.length; index += 1) {
    const turns = stepDuration(steps[index], fastTurns);
    if (turn < cursor + turns) {
      return { index, offset: turn - cursor, step: steps[index] };
    }
    cursor += turns;
  }
  return null;
}

/**
 * 指定ターンに挿入する位置。
 * ノーマルアタックの継続中（開始ターンより後）なら、その技の直後。
 * それ以外は、そのターンを占めている手順の前。範囲外は末尾。
 */
export function insertIndex(steps: TimelineStep[], fastTurns: number, turn: number) {
  let cursor = 1;
  for (let index = 0; index < steps.length; index += 1) {
    const turns = stepDuration(steps[index], fastTurns);
    const start = cursor;
    const end = cursor + turns - 1;
    if (turn <= end) {
      if (steps[index].kind === "fast" && turn > start) return index + 1;
      return index;
    }
    cursor = end + 1;
  }
  return steps.length;
}

export function insertStep(steps: TimelineStep[], fastTurns: number, turn: number, step: TimelineStep) {
  const next = steps.slice();
  next.splice(insertIndex(steps, fastTurns, turn), 0, step);
  return next;
}

export function deleteStep(steps: TimelineStep[], index: number) {
  return steps.filter((_, item) => item !== index);
}

/** `insertAt` は、抜いたあとの列での挿入位置。 */
export function moveStep(steps: TimelineStep[], from: number, insertAt: number) {
  if (from < 0 || from >= steps.length || insertAt === from) return steps;
  const next = steps.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, item);
  return next;
}

/**
 * その時点のゲージで撃てないスペシャルアタックの手順番号。
 * ノーマルアタックが終わったときにチャージし、上限は100。足りない技は消費しない。
 */
export function shortChargedIndexes(steps: TimelineStep[], energyGain: number, energyCost: (moveId: string) => number) {
  const short = new Set<number>();
  let energy = 0;
  steps.forEach((step, index) => {
    if (step.kind === "fast") {
      energy = Math.min(100, energy + Math.max(0, energyGain));
      return;
    }
    if (step.kind !== "charged") return;
    const cost = energyCost(step.moveId);
    if (energy < cost) {
      short.add(index);
      return;
    }
    energy -= cost;
  });
  return short;
}

type SideName = "a" | "b";

type Occupancy = {
  side: SideName;
  index: number;
  step: TimelineStep;
  start: number;
  end: number;
};

function occupancies(steps: TimelineStep[], fastTurns: number, side: SideName): Occupancy[] {
  const spans: Occupancy[] = [];
  let turn = 1;
  steps.forEach((step, index) => {
    const turns = stepDuration(step, fastTurns);
    spans.push({ side, index, step, start: turn, end: turn + turns - 1 });
    turn += turns;
  });
  return spans;
}

/**
 * スペシャルアタックは、進行中のノーマルアタックをそのターンで完了させる。
 * 交代はターンを使うが、相手のノーマルアタックは完了させない（将来の3対3でもこの区別を保つ）。
 */
function closesFastEarly(step: TimelineStep) {
  return step.kind === "charged";
}

export type TimelineView = {
  a: SideClock;
  b: SideClock;
};

/** いまの並びを、対戦のターン規則で見た印。閉じる前の表示に使う。 */
export function inspectTimeline(
  stepsA: TimelineStep[],
  fastTurnsA: number,
  gainA: number,
  costA: (moveId: string) => number,
  stepsB: TimelineStep[],
  fastTurnsB: number,
  gainB: number,
  costB: (moveId: string) => number,
): TimelineView {
  const spansA = occupancies(stepsA, fastTurnsA, "a");
  const spansB = occupancies(stepsB, fastTurnsB, "b");
  const marksA: StepMark[] = stepsA.map(() => "ok");
  const marksB: StepMark[] = stepsB.map(() => "ok");
  const maxTurn = Math.max(spansA[spansA.length - 1]?.end ?? 0, spansB[spansB.length - 1]?.end ?? 0);
  const collapsed = new Set<number>();
  const firingTurns: number[] = [];
  const cutAt = new Map<string, number>();
  const granted = new Set<string>();
  let energyA = 0;
  let energyB = 0;

  const starting = (list: Occupancy[], turn: number) => list.find((span) => span.start === turn);
  const covering = (list: Occupancy[], turn: number) => list.find((span) => span.start <= turn && turn <= span.end);
  const marksOf = (side: SideName) => (side === "a" ? marksA : marksB);

  for (let turn = 1; turn <= maxTurn; turn += 1) {
    for (const span of [starting(spansA, turn), starting(spansB, turn)]) {
      if (span && collapsed.has(turn)) marksOf(span.side)[span.index] = "void";
    }

    let fired = false;
    for (const span of [starting(spansA, turn), starting(spansB, turn)]) {
      if (!span || !closesFastEarly(span.step)) continue;
      const marks = marksOf(span.side);
      if (marks[span.index] === "void" || span.step.kind !== "charged") continue;
      const cost = (span.side === "a" ? costA : costB)(span.step.moveId);
      const energy = span.side === "a" ? energyA : energyB;
      if (!(energy >= cost)) {
        marks[span.index] = "short";
        continue;
      }
      if (span.side === "a") energyA -= cost;
      else energyB -= cost;
      fired = true;
    }
    if (fired) firingTurns.push(turn);

    if (fired) {
      for (const span of [covering(spansA, turn), covering(spansB, turn)]) {
        if (!span || span.step.kind !== "fast" || marksOf(span.side)[span.index] === "void") continue;
        if (span.end <= turn) continue;
        for (let tail = turn + 1; tail <= span.end; tail += 1) collapsed.add(tail);
        cutAt.set(`${span.side}:${span.index}`, turn);
      }
    }

    for (const span of [covering(spansA, turn), covering(spansB, turn)]) {
      if (!span || span.step.kind !== "fast" || marksOf(span.side)[span.index] === "void") continue;
      const key = `${span.side}:${span.index}`;
      if (granted.has(key)) continue;
      const done = cutAt.get(key) ?? span.end;
      if (done !== turn) continue;
      granted.add(key);
      const gain = Math.max(0, span.side === "a" ? gainA : gainB);
      if (span.side === "a") energyA = Math.min(100, energyA + gain);
      else energyB = Math.min(100, energyB + gain);
    }
  }

  return {
    a: clockOf(stepsA, spansA, marksA, cutAt, firingTurns, fastTurnsA, "a"),
    b: clockOf(stepsB, spansB, marksB, cutAt, firingTurns, fastTurnsB, "b"),
  };
}

function clockOf(
  steps: TimelineStep[],
  spans: Occupancy[],
  marks: StepMark[],
  cutAt: Map<string, number>,
  firingTurns: number[],
  natural: number,
  side: SideName,
): SideClock {
  let count = 0;
  const fastCounts = steps.map((step, index) => {
    if (step.kind === "charged" && marks[index] === "ok") {
      count = 0;
      return null;
    }
    if (step.kind === "fast" && marks[index] !== "void") {
      count += 1;
      return count;
    }
    return null;
  });
  const effective = spans.map((span) => {
    if (span.step.kind !== "fast") return 1;
    const cut = cutAt.get(`${side}:${span.index}`);
    if (cut != null) return cut - span.start + 1;
    const stored = span.step.turns;
    if (stored != null && stored < natural) {
      const naturalEnd = span.start + natural - 1;
      const stillCut = firingTurns.some((turn) => span.start <= turn && turn < naturalEnd);
      return stillCut ? stored : natural;
    }
    return natural;
  });
  return { marks, fastCounts, effectiveTurns: effective };
}

export type TimelineFix = {
  stepsA: TimelineStep[];
  stepsB: TimelineStep[];
  /** 残ったスペシャルアタックの、修正前の何発目か。0始まり。 */
  chargedMapA: number[];
  chargedMapB: number[];
};

function sameSteps(left: TimelineStep[], right: TimelineStep[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rewriteSide(steps: TimelineStep[], clock: SideClock, natural: number) {
  const chargedMap: number[] = [];
  const next: TimelineStep[] = [];
  let chargedOrdinal = 0;
  steps.forEach((step, index) => {
    const ordinal = step.kind === "charged" ? chargedOrdinal++ : -1;
    if (clock.marks[index] === "void") return;
    if (step.kind === "charged" && ordinal >= 0) chargedMap.push(ordinal);
    if (step.kind !== "fast") {
      next.push(step);
      return;
    }
    const effective = clock.effectiveTurns[index] ?? natural;
    if (effective >= natural) {
      const { turns: _turns, ...rest } = step;
      next.push(rest);
      return;
    }
    next.push({ ...step, turns: effective });
  });
  return { steps: next, chargedMap };
}

/** 使えない行動を外し、途中完了したノーマルアタックの長さを実ターンに合わせる。後続同士の位置は保つ。 */
export function correctTimeline(
  stepsA: TimelineStep[],
  fastTurnsA: number,
  gainA: number,
  costA: (moveId: string) => number,
  stepsB: TimelineStep[],
  fastTurnsB: number,
  gainB: number,
  costB: (moveId: string) => number,
): TimelineFix {
  let nextA = stepsA;
  let nextB = stepsB;
  let chargedMapA = stepsA.flatMap((step, index) => (step.kind === "charged" ? [index] : [])).map((_, ordinal) => ordinal);
  let chargedMapB = stepsB.flatMap((step) => (step.kind === "charged" ? [0] : [])).map((_, ordinal) => ordinal);
  for (let pass = 0; pass < 8; pass += 1) {
    const view = inspectTimeline(nextA, fastTurnsA, gainA, costA, nextB, fastTurnsB, gainB, costB);
    const rewrittenA = rewriteSide(nextA, view.a, fastTurnsA);
    const rewrittenB = rewriteSide(nextB, view.b, fastTurnsB);
    chargedMapA = rewrittenA.chargedMap.map((ordinal) => chargedMapA[ordinal]).filter((ordinal) => ordinal != null);
    chargedMapB = rewrittenB.chargedMap.map((ordinal) => chargedMapB[ordinal]).filter((ordinal) => ordinal != null);
    if (sameSteps(rewrittenA.steps, nextA) && sameSteps(rewrittenB.steps, nextB)) break;
    nextA = rewrittenA.steps;
    nextB = rewrittenB.steps;
  }
  return { stepsA: nextA, stepsB: nextB, chargedMapA, chargedMapB };
}

export function planFromEvents(
  events: { turn: number; actor: "a" | "b"; kind: "fast" | "charged"; moveId: string; actionId: number }[],
  actor: "a" | "b",
): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const seen = new Set<number>();
  const ordered = events.slice().sort((left, right) => left.turn - right.turn);
  for (const event of ordered) {
    if (event.actor !== actor || seen.has(event.actionId)) continue;
    seen.add(event.actionId);
    if (event.kind === "charged") steps.push({ kind: "charged", moveId: event.moveId });
    else steps.push({ kind: "fast", moveId: event.moveId });
  }
  return steps;
}
