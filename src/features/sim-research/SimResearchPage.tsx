import { useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { LeagueIconButton } from "../../components/LeagueIconButton";
import { PokemonDotSprite } from "../../components/PokemonDotSprite";
import { damageForMove, type PvpMove } from "../../lib/pogo/combat";
import { bestMoves } from "../../lib/pogo/moveScore";
import { findPvpPokemon, resolveMoves } from "../../lib/pogo/pvpBundle";
import {
  computeBestRankings,
  findMaxLevelBuild,
  formatBattleStat,
  formatScp,
  leagueCap,
  leagueConfigs,
  speciesDisplayName,
  type LeagueId,
  type PogoStatRecord,
  type SpeciesGroup,
} from "../../lib/pogo/research";
import { simulateBattle, simulateShieldGrid, type ChargeTiming, type FighterInput, type TimelineEvent } from "../../lib/pogo/simulate";
import { useResearchData } from "../shared/useResearchData";
import { openPokemonSearch } from "../shared/pokemonSearchApi";

const SOZAI_SHADOW_SRC = "/Image/sozai/shadow.png";
const SOZAI_SHIELD_SRC = "/Image/sozai/shield-ui.png";

function ShadowMark() {
  return <img className="sim-shadow-mark" src={SOZAI_SHADOW_SRC} alt="" width={22} height={22} decoding="async" />;
}

function ShieldMark({ size = 16 }: { size?: number }) {
  const height = Math.round(size * (25 / 22));
  return (
    <img
      className="sozai-shield"
      src={SOZAI_SHIELD_SRC}
      alt="防"
      width={size}
      height={height}
      decoding="async"
    />
  );
}

type SideState = {
  record: PogoStatRecord | null;
  label: string;
  exactSprite: boolean;
  spriteSuffix: number | null;
  shadow: boolean;
  atkIv: number;
  defIv: number;
  staIv: number;
  fastId: string;
  chargedId: string;
  chargedId2: string;
  shields: number;
  timing: ChargeTiming;
  applyChanceBuffs: boolean;
};

const emptySide: SideState = {
  record: null,
  label: "",
  exactSprite: false,
  spriteSuffix: null,
  shadow: false,
  atkIv: 0,
  defIv: 15,
  staIv: 15,
  fastId: "",
  chargedId: "",
  chargedId2: "",
  shields: 0,
  timing: "cct",
  applyChanceBuffs: false,
};

function clampIv(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(15, Math.max(0, Math.round(value)));
}

export function SimResearchPage() {
  const { data, error, cpData, reload } = useResearchData();
  const [leagueId, setLeagueId] = useState<LeagueId>("great");
  const [sideA, setSideA] = useState<SideState>(emptySide);
  const [sideB, setSideB] = useState<SideState>(emptySide);

  const cap = leagueCap(leagueId);
  const fighterA = packFighter(sideA, data, cpData, cap);
  const fighterB = packFighter(sideB, data, cpData, cap);

  const result = useMemo(() => {
    if (!fighterA || !fighterB) return null;
    return simulateBattle(fighterA.input, fighterB.input);
  }, [fighterA, fighterB]);

  const grid = useMemo(() => {
    if (!fighterA || !fighterB) return null;
    return simulateShieldGrid(fighterA.input, fighterB.input);
  }, [fighterA, fighterB]);

  return (
    <div className="page-iv sim-page">
      <div className="page-heading">
        <a className="btn btn-secondary btn-back" href="#/">
          <ArrowLeft size={16} />
          ホーム
        </a>
        <div>
          <h1>バトルシミュレーション研究</h1>
          <p className="page-lead">2匹を横に並べたまま、シールドと技のタイミングを変えます。名前を押すと検索して入れ替えられます。</p>
        </div>
      </div>

      {error ? (
        <section className="panel">
          <h2 className="panel-title">データを読み込めませんでした</h2>
          <p className="page-lead">{error}</p>
          <button type="button" className="btn btn-primary" onClick={reload}>
            再読み込み
          </button>
        </section>
      ) : null}

      {!data && !error ? (
        <section className="panel" aria-busy="true">
          <p className="page-lead">研究データを読み込み中です。</p>
        </section>
      ) : null}

      {data && cpData ? (
        <>
          <svg className="type-wash-defs" aria-hidden="true" focusable="false">
            <filter id="type-wash" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="56" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <div className="choice-row league-row" role="group" aria-label="リーグ">
            {leagueConfigs
              .filter((league) => league.id !== "custom")
              .map((league) => (
                <LeagueIconButton
                  key={league.id}
                  id={league.id}
                  label={league.label}
                  pressed={league.id === leagueId}
                  onClick={() => setLeagueId(league.id)}
                />
              ))}
          </div>

          <div className="duel-grid">
            <FighterCard
              title="自分"
              tone="self"
              side={sideA}
              data={data}
              cap={cap}
              levels={cpData.levels}
              byLevel={cpData.byLevel}
              onChange={setSideA}
            />
            <FighterCard
              title="相手"
              tone="foe"
              side={sideB}
              data={data}
              cap={cap}
              levels={cpData.levels}
              byLevel={cpData.byLevel}
              onChange={setSideB}
            />
          </div>
          <p className="note">最適は相手の技に合わせます。追加効果を入れると、確率の変化も必ず起きます。</p>

          {result && fighterA && fighterB ? (
            <>
              <section className="panel result-panel sim-result" aria-label="この対面">
                <div className="sim-matchup">
                  <MatchupSide
                    word={result.winner === "draw" ? null : result.winner === "a" ? "WIN" : "LOSE"}
                    side={sideA}
                    hp={result.hpA}
                    max={result.maxHpA}
                    attack={fighterA.build.attack}
                    defense={fighterA.build.defense}
                    stamina={fighterA.build.stamina}
                    hits={matchupMoveHits(fighterA.input, fighterB.input)}
                  />
                  <MatchupSide
                    word={result.winner === "draw" ? null : result.winner === "b" ? "WIN" : "LOSE"}
                    side={sideB}
                    hp={result.hpB}
                    max={result.maxHpB}
                    attack={fighterB.build.attack}
                    defense={fighterB.build.defense}
                    stamina={fighterB.build.stamina}
                    hits={matchupMoveHits(fighterB.input, fighterA.input)}
                  />
                </div>
                <p className="note">{result.turns}ターン</p>
              </section>

              {grid && sideA.record && sideB.record ? (
                <section className="panel shield-panel" aria-label="シールド9マス">
                  <div className="shield-grid" role="grid" aria-label="シールド評価">
                    <span className="shield-corner">
                      <PokemonDotSprite
                        className="corner-self"
                        pokemonId={sideA.record.pokemon_id}
                        form={sideA.exactSprite ? undefined : sideA.record.form}
                        exact={sideA.exactSprite}
                        spriteSuffix={sideA.spriteSuffix}
                        alt=""
                        size={22}
                      />
                      <PokemonDotSprite
                        className="corner-foe"
                        pokemonId={sideB.record.pokemon_id}
                        form={sideB.exactSprite ? undefined : sideB.record.form}
                        exact={sideB.exactSprite}
                        spriteSuffix={sideB.spriteSuffix}
                        alt=""
                        size={22}
                      />
                    </span>
                    {[0, 1, 2].map((shieldsB) => (
                      <span key={`h-${shieldsB}`} className="shield-head">
                        <ShieldMark size={15} />
                        <span>×{shieldsB}</span>
                      </span>
                    ))}
                    {grid.flatMap((row, shieldsA) => [
                      <span key={`l-${shieldsA}`} className="shield-head">
                        <ShieldMark size={15} />
                        <span>×{shieldsA}</span>
                      </span>,
                      ...row.map((cell, shieldsB) => {
                        const selected = sideA.shields === shieldsA && sideB.shields === shieldsB;
                        const tone = cell.rating > 100 ? "win" : cell.rating < 100 ? "lose" : "draw";
                        return (
                          <button
                            key={`${shieldsA}-${shieldsB}`}
                            type="button"
                            className={`shield-cell is-${tone}${selected ? " is-selected" : ""}`}
                            style={{ background: shieldFill(cell.rating) }}
                            aria-pressed={selected}
                            aria-label={`自分${shieldsA} 相手${shieldsB} ${cell.rating}`}
                            onClick={() => {
                              setSideA((current) => ({ ...current, shields: shieldsA }));
                              setSideB((current) => ({ ...current, shields: shieldsB }));
                            }}
                          >
                            <strong className="num">{cell.rating}</strong>
                          </button>
                        );
                      }),
                    ])}
                  </div>
                  <p className="note">マスを押すと、その枚数の結果に切り替わります。自分の枚数が縦、相手が横です。</p>
                </section>
              ) : null}

              <p className="sim-section-label">タイムライン</p>
              <section className="panel battle-sheet-panel">
                <BattleSheet events={result.timeline} />
              </section>
            </>
          ) : (
            <section className="panel">
              <p className="page-lead">両方のポケモンにノーマルアタックが入ると、シミュレーションが始まります。</p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

function packFighter(
  side: SideState,
  data: ReturnType<typeof useResearchData>["data"],
  cpData: ReturnType<typeof useResearchData>["cpData"],
  cap: number,
) {
  if (!data || !cpData || !side.record) return null;
  const entry = side.record;
  const pvp = findPvpPokemon(data.bundle, entry.pokemon_id, entry.form);
  if (!pvp) return null;
  const fasts = resolveMoves(data.bundle, pvp.fast);
  const chargedMoves = resolveMoves(data.bundle, pvp.charged);
  const fast = fasts.find((move) => move.id === side.fastId) ?? fasts[0];
  if (!fast) return null;
  const charged = [side.chargedId, side.chargedId2]
    .map((id) => chargedMoves.find((move) => move.id === id) ?? null)
    .filter((move): move is PvpMove => Boolean(move));
  const build = findMaxLevelBuild(entry, side.atkIv, side.defIv, side.staIv, cpData.levels, cpData.byLevel, cap);
  if (!build) return null;
  const input: FighterInput = {
    label: side.label || entry.pokemon_name,
    attack: build.attack,
    defense: build.defense,
    hp: build.stamina,
    types: pvp.types,
    shadow: side.shadow,
    fast,
    charged,
    shields: side.shields,
    timing: side.timing,
    applyChanceBuffs: side.applyChanceBuffs,
  };
  return { name: side.label || entry.pokemon_name, pvp, build, fasts, chargedMoves, input };
}

function FighterCard({
  title,
  tone,
  side,
  data,
  cap,
  levels,
  byLevel,
  onChange,
}: {
  title: string;
  tone: "self" | "foe";
  side: SideState;
  data: NonNullable<ReturnType<typeof useResearchData>["data"]>;
  cap: number;
  levels: number[];
  byLevel: Map<string, number>;
  onChange: (next: SideState | ((current: SideState) => SideState)) => void;
}) {
  const packed = packFighter(side, data, { levels, byLevel }, cap);
  const fasts = packed?.fasts ?? [];
  const chargedMoves = packed?.chargedMoves ?? [];
  const fastValue = fasts.some((move) => move.id === side.fastId) ? side.fastId : (fasts[0]?.id ?? "");
  const chargedValue = chargedMoves.some((move) => move.id === side.chargedId) ? side.chargedId : (chargedMoves[0]?.id ?? "");
  const charged2Value = chargedMoves.some((move) => move.id === side.chargedId2) ? side.chargedId2 : "";
  const stats = packed?.build;
  const types = packed?.pvp.types ?? [];
  const typeStyle: CSSProperties | undefined = types.length
    ? ({
        "--type-main": typePastel(types[0]),
        "--type-accent": typePastel(types[1] ?? types[0]),
      } as CSSProperties)
    : undefined;

  return (
    <section className={`sim-card is-${tone}${types.length ? " has-type" : ""}`} style={typeStyle}>
      <div className="sim-card-head">
        <p className="sim-role">{title}</p>
        {side.record ? (
          <button
            type="button"
            className="league-choice sim-shadow-toggle"
            aria-pressed={side.shadow}
            aria-label={side.shadow ? "シャドウを外す" : "シャドウにする"}
            onClick={() => onChange({ ...side, shadow: !side.shadow })}
          >
            <ShadowMark />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="identity-pick"
        onClick={() => {
          openPokemonSearch((group: SpeciesGroup) => {
            const entry = group.entries[0];
            if (!entry) return;
            const pvp = findPvpPokemon(data.bundle, entry.pokemon_id, entry.form);
            const nextFasts = pvp ? resolveMoves(data.bundle, pvp.fast) : [];
            const nextCharged = pvp ? resolveMoves(data.bundle, pvp.charged) : [];
            const types = pvp?.types ?? [];
            const rankedFast = bestMoves(nextFasts, types, "fast");
            const rankedCharged = bestMoves(nextCharged, types, "charged");
            const best = computeBestRankings(entry, levels, byLevel, cap)[0];
            onChange((current) => ({
              ...current,
              record: entry,
              label: speciesDisplayName(group),
              exactSprite: Boolean(group.exactSprite),
              spriteSuffix: group.spriteSuffix ?? null,
              fastId: rankedFast[0]?.id ?? "",
              chargedId: rankedCharged[0]?.id ?? "",
              chargedId2: rankedCharged[1]?.id ?? "",
              atkIv: best?.atkIv ?? current.atkIv,
              defIv: best?.defIv ?? current.defIv,
              staIv: best?.staIv ?? current.staIv,
            }));
          });
        }}
      >
        <span className="sprite-slot">
          {side.record ? (
            <PokemonDotSprite
              pokemonId={side.record.pokemon_id}
              form={side.exactSprite ? undefined : side.record.form}
              exact={side.exactSprite}
              spriteSuffix={side.spriteSuffix}
              alt=""
              size={40}
            />
          ) : (
            <img className="pokemon-dot-sprite" src="/Image/sprite/Question_Mark.png" alt="" width={40} height={40} />
          )}
        </span>
        <span className="identity-pick-name">{side.record ? side.label : "検索"}</span>
      </button>

      {!side.record ? null : stats ? (
        <>
          <div className="sim-power-line">
            <p className="sim-power-item">
              <span>CP</span>
              <strong className="sim-cp num">{stats.cp}</strong>
            </p>
            <p className="sim-power-item">
              <span>SCP</span>
              <strong className="sim-scp num">{formatScp(stats.statProduct)}</strong>
            </p>
          </div>
          <p className="sim-battle-stats num" aria-label="実数値">
            <span>{formatBattleStat(stats.attack, 2)}</span>
            <span>{formatBattleStat(stats.defense, 2)}</span>
            <span>{stats.stamina}</span>
          </p>
        </>
      ) : side.record ? (
        <p className="note">このリーグのCP上限に入るレベルがありません。</p>
      ) : null}

      {side.record && !packed ? <p className="note">技データがありません。</p> : null}

      {side.record ? (
        <>
      <div className="sim-ivs">
        <IvBox label="攻撃" value={side.atkIv} onChange={(atkIv) => onChange({ ...side, atkIv })} />
        <IvBox label="防御" value={side.defIv} onChange={(defIv) => onChange({ ...side, defIv })} />
        <IvBox label="HP" value={side.staIv} onChange={(staIv) => onChange({ ...side, staIv })} />
      </div>

      <label className="field">
        <span className="field-label">ノーマルアタック</span>
        <select className="input" value={fastValue} onChange={(event) => onChange({ ...side, fastId: event.target.value })}>
          {fasts.map((move) => (
            <option key={move.id} value={move.id}>
              {move.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">スペシャルアタック</span>
        <select className="input" value={chargedValue} onChange={(event) => onChange({ ...side, chargedId: event.target.value })}>
          {chargedMoves.map((move) => (
            <option key={move.id} value={move.id}>
              {move.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">スペシャルアタック2</span>
        <select className="input" value={charged2Value} onChange={(event) => onChange({ ...side, chargedId2: event.target.value })}>
          <option value="">なし</option>
          {chargedMoves.map((move) => (
            <option key={move.id} value={move.id}>
              {move.name}
            </option>
          ))}
        </select>
      </label>
        </>
      ) : null}
    </section>
  );
}

type SheetCell = {
  show: boolean;
  span: number;
  name: string;
  type: string;
  damage: number;
  shielded: boolean;
  endsCharge: boolean;
  cct: boolean;
};

type TurnRow = { turn: number; hpA: number; hpB: number; a: TimelineEvent | null; b: TimelineEvent | null };

function buildSheet(events: TimelineEvent[]) {
  const turns: TurnRow[] = [];
  for (const event of events) {
    let row = turns[turns.length - 1];
    if (!row || row.turn !== event.turn) {
      row = { turn: event.turn, hpA: event.hpA, hpB: event.hpB, a: null, b: null };
      turns.push(row);
    }
    row.hpA = event.hpA;
    row.hpB = event.hpB;
    row[event.actor] = event;
  }

  const chargeTurns = new Set(
    turns.filter((row) => row.a?.kind === "charged" || row.b?.kind === "charged").map((row) => row.turn),
  );
  const cellsA = moveSegments(turns, "a", chargeTurns);
  const cellsB = moveSegments(turns, "b", chargeTurns);

  return turns.map((row) => ({
    turn: row.turn,
    hpA: row.hpA,
    hpB: row.hpB,
    charge: chargeTurns.has(row.turn),
    guardA: receivedShield(row, "a"),
    guardB: receivedShield(row, "b"),
    a: cellsA.get(row.turn) ?? null,
    b: cellsB.get(row.turn) ?? null,
  }));
}

function receivedShield(row: TurnRow, actor: "a" | "b") {
  const other = actor === "a" ? row.b : row.a;
  return Boolean(other?.kind === "charged" && other.shielded);
}

function moveSegments(turns: TurnRow[], actor: "a" | "b", chargeTurns: Set<number>) {
  const cells = new Map<number, SheetCell | null>();
  let index = 0;
  while (index < turns.length) {
    const event = turns[index][actor];
    if (!event) {
      cells.set(turns[index].turn, null);
      index += 1;
      continue;
    }

    const startedEarlier = index > 0 && turns[index - 1][actor]?.actionId === event.actionId;
    if (startedEarlier && receivedShield(turns[index], actor) && event.kind === "fast") {
      cells.set(turns[index].turn, {
        show: true,
        span: 1,
        name: "",
        type: "",
        damage: 0,
        shielded: false,
        endsCharge: chargeTurns.has(turns[index].turn),
        cct: false,
      });
      index += 1;
      continue;
    }

    let end = index;
    while (end < turns.length && turns[end][actor]?.actionId === event.actionId) {
      if (end > index && receivedShield(turns[end], actor)) break;
      const splitAfter = chargeTurns.has(turns[end].turn);
      end += 1;
      if (splitAfter) break;
    }

    const slice = turns.slice(index, end);
    let landing = [...slice].reverse().find((row) => (row[actor]?.damage ?? 0) > 0)?.[actor];
    const following = turns[end]?.[actor];
    if (!landing && following?.actionId === event.actionId && (following.damage ?? 0) > 0) landing = following;
    const endsCharge = chargeTurns.has(turns[end - 1].turn);
    cells.set(turns[index].turn, {
      show: true,
      span: end - index,
      name: event.moveName,
      type: event.moveType,
      damage: landing?.damage ?? 0,
      shielded: landing?.shielded ?? false,
      endsCharge,
      cct: event.kind === "fast" && event.cct,
    });
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      cells.set(turns[cursor].turn, {
        show: false,
        span: 0,
        name: "",
        type: "",
        damage: 0,
        shielded: false,
        endsCharge: false,
        cct: false,
      });
    }
    index = end;
  }
  return cells;
}

function BattleSheet({ events }: { events: TimelineEvent[] }) {
  const rows = buildSheet(events);
  return (
    <table className="battle-sheet" aria-label="行動">
      <colgroup>
        <col className="col-hp" />
        <col className="col-move" />
        <col className="col-turn" />
        <col className="col-move" />
        <col className="col-hp" />
      </colgroup>
      <tbody>
        {rows.map((row, index) => {
          const prev = rows[index - 1];
          return (
            <tr key={row.turn} className={row.charge ? "has-charge" : undefined}>
              <td className="hp num">{!prev || prev.hpA !== row.hpA ? row.hpA : ""}</td>
              <MoveCell cell={row.a} guard={row.guardA} />
              <td className="turn num">{row.turn}</td>
              <MoveCell cell={row.b} guard={row.guardB} />
              <td className="hp num">{!prev || prev.hpB !== row.hpB ? row.hpB : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MoveCell({ cell, guard }: { cell: SheetCell | null; guard: boolean }) {
  if (cell && !cell.show) return null;
  if (!cell?.name) {
    if (guard) {
      return (
        <td className={`move is-guard${cell?.endsCharge ? " ends-charge" : ""}`}>
          <span className="move-shield-wrap">
            <ShieldMark size={13} />
          </span>
        </td>
      );
    }
    return <td className="move is-empty" />;
  }
  const stacked = guard;
  const moveMain = (
    <span className="move-line-main">
      {cell.name ? <span className="move-name">{cell.name}</span> : null}
      {cell.damage > 0 ? <span className="num move-dmg">{cell.damage}</span> : null}
    </span>
  );
  return (
    <td
      className={`move${cell.endsCharge ? " ends-charge" : ""}${stacked ? " is-stacked" : ""}`}
      rowSpan={cell.span}
      style={cell.name ? { background: typeWash(cell.type) } : undefined}
    >
      {stacked ? (
        <span className="move-label is-stacked">
          {moveMain}
          {cell.cct ? <span className="cct-mark">CCT</span> : null}
          <span className="move-shield-wrap">
            <ShieldMark size={13} />
          </span>
        </span>
      ) : (
        <span className={`move-label${cell.cct ? " has-cct" : ""}`}>
          {moveMain}
          {cell.cct ? <span className="cct-mark">CCT</span> : null}
        </span>
      )}
    </td>
  );
}

type MatchupHitRow = {
  id: string;
  name: string;
  damage: number;
  percent: number;
  remainRatio: number;
  band: "low" | "mid" | "high";
};

function matchupMoveHits(attacker: FighterInput, defender: FighterInput): MatchupHitRow[] {
  const moves = [attacker.fast, ...attacker.charged];
  const seen = new Set<string>();
  const rows: MatchupHitRow[] = [];
  for (const move of moves) {
    if (seen.has(move.id)) continue;
    seen.add(move.id);
    const damage = damageForMove(
      move,
      attacker.attack,
      defender.defense,
      attacker.types,
      defender.types,
      attacker.shadow,
      defender.shadow,
    );
    const maxHp = Math.max(1, defender.hp);
    const percent = (100 * damage) / maxHp;
    const remainRatio = Math.max(0, Math.min(1, (maxHp - damage) / maxHp));
    const band = remainRatio <= 0.2 ? "low" : remainRatio <= 0.5 ? "mid" : "high";
    rows.push({
      id: move.id,
      name: move.name,
      damage,
      percent,
      remainRatio,
      band,
    });
  }
  return rows;
}

function MatchupSide({
  word,
  side,
  hp,
  max,
  attack,
  defense,
  stamina,
  hits,
}: {
  word: "WIN" | "LOSE" | null;
  side: SideState;
  hp: number;
  max: number;
  attack: number;
  defense: number;
  stamina: number;
  hits: MatchupHitRow[];
}) {
  const ratio = max > 0 ? hp / max : 0;
  const band = ratio <= 0.2 ? "low" : ratio <= 0.5 ? "mid" : "high";
  return (
    <div className="sim-matchup-side">
      <p className={word === "WIN" ? "sim-win" : word === "LOSE" ? "sim-lose" : "sim-draw"}>{word ?? "相打ち"}</p>
      <div className="sim-mon-block">
        {side.record ? (
          <PokemonDotSprite
            pokemonId={side.record.pokemon_id}
            form={side.exactSprite ? undefined : side.record.form}
            exact={side.exactSprite}
            spriteSuffix={side.spriteSuffix}
            alt=""
            size={68}
          />
        ) : null}
        <dl className="sim-real-stats">
          <div>
            <dt>攻撃：</dt>
            <dd className="num">{formatBattleStat(attack, 2)}</dd>
          </div>
          <div>
            <dt>防御：</dt>
            <dd className="num">{formatBattleStat(defense, 2)}</dd>
          </div>
          <div>
            <dt>HP：</dt>
            <dd className="num">{stamina}</dd>
          </div>
        </dl>
      </div>
      <p className="sim-hp-now num">
        {hp} / {max}
      </p>
      <div className={`hp-track is-${band}`}>
        <i style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
      </div>
      {hits.length ? (
        <ul className="sim-hit-list" aria-label="技ダメージ">
          {hits.map((row) => {
            const lossRatio = Math.max(0, Math.min(1, 1 - row.remainRatio));
            const remainPct = row.remainRatio * 100;
            const lossPct = lossRatio * 100;
            const onlyRemain = lossPct <= 0;
            const onlyLoss = remainPct <= 0;
            return (
              <li key={row.id} className="sim-hit-row">
                <div className="sim-hit-meta">
                  <span className="sim-hit-name">{row.name}</span>
                  <span className="sim-hit-val num">
                    {row.damage}({row.percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="hp-track hp-track-hit" aria-hidden="true">
                  {onlyLoss ? (
                    <i className="hp-hit-lost is-full" style={{ width: "100%" }} />
                  ) : (
                    <>
                      <i
                        className={`hp-hit-remain is-${row.band}${onlyRemain ? " is-full" : ""}`}
                        style={{ width: `${remainPct}%` }}
                      />
                      {lossPct > 0 ? <i className="hp-hit-lost" style={{ width: `${lossPct}%` }} /> : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function shieldFill(rating: number) {
  if (rating === 100) return "linear-gradient(180deg, #f7f8fa 0%, #e6ebf0 100%)";
  if (rating > 100) {
    const t = Math.min(1, (rating - 100) / 50);
    return `linear-gradient(180deg, ${mixRgb([255, 232, 232], [248, 168, 168], t)} 0%, ${mixRgb([246, 208, 208], [228, 112, 112], t)} 100%)`;
  }
  const t = Math.min(1, (100 - rating) / 50);
  return `linear-gradient(180deg, ${mixRgb([242, 245, 255], [206, 210, 244], t)} 0%, ${mixRgb([224, 228, 246], [148, 156, 224], t)} 100%)`;
}

function mixRgb(from: [number, number, number], to: [number, number, number], t: number) {
  const channel = (start: number, end: number) => Math.round(start + (end - start) * t);
  return `rgb(${channel(from[0], to[0])}, ${channel(from[1], to[1])}, ${channel(from[2], to[2])})`;
}

const TYPE_PASTEL: Record<string, string> = {
  normal: "#e4ddd2",
  fire: "#f7c7b4",
  water: "#b7ddf6",
  electric: "#f8ebae",
  grass: "#c5e6bc",
  ice: "#d2f3f6",
  fighting: "#f3c4bc",
  poison: "#e2c6ea",
  ground: "#ead7b4",
  flying: "#d4e0f6",
  psychic: "#f6c6dc",
  bug: "#dce8aa",
  rock: "#e6dcc6",
  ghost: "#d2cbe4",
  dragon: "#c9d2f4",
  dark: "#d4cedc",
  steel: "#dce3e8",
  fairy: "#f8d4e8",
};

function typePastel(type: string) {
  return TYPE_PASTEL[type] ?? "#e7eef2";
}

function typeWash(type: string) {
  return `color-mix(in srgb, ${typePastel(type)} 51%, white)`;
}

function IvBox({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input iv-input"
        type="number"
        min={0}
        max={15}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(clampIv(Number(event.target.value)))}
      />
    </label>
  );
}
