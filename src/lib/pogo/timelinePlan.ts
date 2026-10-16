export type TimelineStep =
  | { kind: "fast"; moveId: string; /** 途中完了したときの実ターン数。未指定は技本来のターン数。 */ turns?: number }
  | { kind: "charged"; moveId: string }
  | { kind: "wait" }
  /** 枠だけ残す。技は入らない。消したあとに次の技を滑り込ませない。 */
  | { kind: "blank" };

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

function blanks(count: number): TimelineStep[] {
  return Array.from({ length: Math.max(1, count) }, () => ({ kind: "blank" as const }));
}

/**
 * スペシャルアタックの直前に、相手のノーマルアタックで余るターンぶんの空白を置く。
 * 空白は枠を残す。次の技はそこへ進まない。
 */
export function withSpecialBlanks(steps: TimelineStep[], foeFastTurns: number) {
  const gap = Math.max(0, Math.floor(foeFastTurns) - 1);
  if (gap === 0) return steps;
  const next: TimelineStep[] = [];
  for (const step of steps) {
    if (step.kind === "charged") {
      let have = 0;
      for (let index = next.length - 1; index >= 0 && next[index]?.kind === "blank" && have < gap; index -= 1) have += 1;
      for (let extra = have; extra < gap; extra += 1) next.push({ kind: "blank" });
    }
    next.push(step);
  }
  return next;
}

/** その手順を消し、同じ長さの空白を残す。スペシャルの並びは、残った技の元の番号。 */
export function holdAsBlank(steps: TimelineStep[], index: number, fastTurns: number) {
  const chargedMap: number[] = [];
  let ordinal = 0;
  const next: TimelineStep[] = [];
  steps.forEach((step, stepIndex) => {
    const mine = step.kind === "charged" ? ordinal++ : -1;
    if (stepIndex === index) {
      next.push(...blanks(step.kind === "fast" ? stepDuration(step, fastTurns) : 1));
      return;
    }
    if (mine >= 0) chargedMap.push(mine);
    next.push(step);
  });
  return { steps: next, chargedMap };
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
 * そのターンを占めている手順の前。範囲外は末尾。
 * ノーマルアタックの継続中でも、その場に割って入る（直後へ送らない）。
 */
export function insertIndex(steps: TimelineStep[], fastTurns: number, turn: number) {
  let cursor = 1;
  for (let index = 0; index < steps.length; index += 1) {
    const turns = stepDuration(steps[index], fastTurns);
    const end = cursor + turns - 1;
    if (turn <= end) return index;
    cursor = end + 1;
  }
  return steps.length;
}

/** 新しいスペシャルの並び。元からあった技はその番号、今入った技は -1。 */
function withChargedMap(before: TimelineStep[], after: TimelineStep[]) {
  const oldOf = new Map<TimelineStep, number>();
  let ordinal = 0;
  before.forEach((step) => {
    if (step.kind === "charged") oldOf.set(step, ordinal++);
  });
  const chargedMap: number[] = [];
  after.forEach((step) => {
    if (step.kind !== "charged") return;
    chargedMap.push(oldOf.get(step) ?? -1);
  });
  return chargedMap;
}

/** 継続中のノーマルアタックを、指定オフセットで前後に割る。 */
function splitFast(steps: TimelineStep[], index: number, offset: number, step: TimelineStep, fastTurns: number) {
  const fast = steps[index];
  if (!fast || fast.kind !== "fast" || offset <= 0) return steps;
  const total = stepDuration(fast, fastTurns);
  const head: TimelineStep = { kind: "fast", moveId: fast.moveId, turns: offset };
  const tailTurns = total - offset;
  const next = steps.slice();
  next.splice(index, 1, head, step, ...(tailTurns > 0 ? blanks(tailTurns) : []));
  return next;
}

export function insertStep(steps: TimelineStep[], fastTurns: number, turn: number, step: TimelineStep) {
  const located = locateTurn(steps, fastTurns, turn);
  if (located && located.offset === 0 && located.step.kind === "blank") {
    const next = steps.slice();
    next[located.index] = step;
    return next;
  }
  if (located && located.step.kind === "fast" && located.offset > 0) {
    return splitFast(steps, located.index, located.offset, step, fastTurns);
  }
  const next = steps.slice();
  next.splice(insertIndex(steps, fastTurns, turn), 0, step);
  return next;
}

/**
 * 表示上ひとまとまりのターンへ技を置く。
 * その中の空白があれば、先頭の空白に入る。無ければそのターンへ割って入る。
 */
export function placeStep(steps: TimelineStep[], fastTurns: number, turn: number, span: number, step: TimelineStep) {
  const before = steps;
  for (let cursor = turn; cursor < turn + Math.max(1, span); cursor += 1) {
    const located = locateTurn(steps, fastTurns, cursor);
    if (located && located.offset === 0 && located.step.kind === "blank") {
      const next = steps.slice();
      next[located.index] = step;
      return { steps: next, chargedMap: withChargedMap(before, next) };
    }
  }
  const next = insertStep(steps, fastTurns, turn, step);
  return { steps: next, chargedMap: withChargedMap(before, next) };
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

function rewriteSide(steps: TimelineStep[], clock: SideClock) {
  const chargedMap: number[] = [];
  const next: TimelineStep[] = [];
  let chargedOrdinal = 0;
  steps.forEach((step, index) => {
    const ordinal = step.kind === "charged" ? chargedOrdinal++ : -1;
    if (clock.marks[index] === "void") {
      const count = step.kind === "fast" ? Math.max(1, clock.effectiveTurns[index] ?? 1) : 1;
      next.push(...blanks(count));
      return;
    }
    if (step.kind === "charged" && ordinal >= 0) chargedMap.push(ordinal);
    next.push(step);
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
    const rewrittenA = rewriteSide(nextA, view.a);
    const rewrittenB = rewriteSide(nextB, view.b);
    chargedMapA = rewrittenA.chargedMap.map((ordinal) => chargedMapA[ordinal]).filter((ordinal) => ordinal != null);
    chargedMapB = rewrittenB.chargedMap.map((ordinal) => chargedMapB[ordinal]).filter((ordinal) => ordinal != null);
    if (sameSteps(rewrittenA.steps, nextA) && sameSteps(rewrittenB.steps, nextB)) break;
    nextA = rewrittenA.steps;
    nextB = rewrittenB.steps;
  }
  return { stepsA: nextA, stepsB: nextB, chargedMapA, chargedMapB };
}

export type DisplayRow = {
  /** 手順上のターン。1始まり。 */
  turn: number;
  /** 画面のターン番号。空白だけで続いている行は null。 */
  label: number | null;
  /** この番号が何行分か。番号の無い行は 0。 */
  span: number;
};

function startsNumbered(span: TimelineSpan | undefined, turn: number) {
  if (!span || span.startTurn !== turn) return false;
  return span.step.kind !== "blank";
}

/** 空白や、技の継続だけで相手も動いていない行は、前のターン番号に結合する。 */
export function displayRows(stepsA: TimelineStep[], fastA: number, stepsB: TimelineStep[], fastB: number): DisplayRow[] {
  const spansA = expandPlan(stepsA, fastA);
  const spansB = expandPlan(stepsB, fastB);
  const total = Math.max(planTurns(stepsA, fastA), planTurns(stepsB, fastB), 1);
  const owns: boolean[] = [];
  for (let turn = 1; turn <= total; turn += 1) {
    const a = spansA.find((span) => turn >= span.startTurn && turn < span.startTurn + span.turns);
    const b = spansB.find((span) => turn >= span.startTurn && turn < span.startTurn + span.turns);
    owns.push(startsNumbered(a, turn) || startsNumbered(b, turn));
  }
  const rows: DisplayRow[] = [];
  let label = 0;
  for (let index = 0; index < owns.length; index += 1) {
    if (!owns[index]) {
      rows.push({ turn: index + 1, label: null, span: 0 });
      continue;
    }
    label += 1;
    let span = 1;
    while (index + span < owns.length && !owns[index + span]) span += 1;
    rows.push({ turn: index + 1, label, span });
  }
  return rows;
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
