export type TimelineStep =
  | { kind: "fast"; moveId: string }
  | { kind: "charged"; moveId: string }
  | { kind: "wait" };

export type TimelineSpan = {
  stepIndex: number;
  step: TimelineStep;
  startTurn: number;
  turns: number;
};

export function stepDuration(step: TimelineStep, fastTurns: number) {
  if (step.kind === "fast") return Math.max(1, fastTurns);
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
