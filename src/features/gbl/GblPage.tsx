import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { LeagueIconButton } from "../../components/LeagueIconButton";
import { PokemonDotSprite } from "../../components/PokemonDotSprite";
import type { LeagueMarkId } from "../../lib/pogo/leagueMark";
import { loadGblMatches, type GblLeague, type GblMatch, type GblMon } from "./gblApi";

const LEAGUES: { id: GblLeague; label: string }[] = [
  { id: "little", label: "リトルカップ" },
  { id: "great", label: "スーパーリーグ" },
  { id: "ultra", label: "ハイパーリーグ" },
  { id: "master", label: "マスターリーグ" },
];

function playerFromHash() {
  const path = window.location.hash.replace(/^#/, "").split("?")[0].replace(/\/+$/, "");
  const prefix = "/research/gbl";
  if (path === prefix || path === "") return null;
  if (!path.startsWith(`${prefix}/`)) return null;
  try {
    return decodeURIComponent(path.slice(prefix.length + 1));
  } catch {
    return null;
  }
}

export function GblPage() {
  const [player, setPlayer] = useState<string | null>(() => playerFromHash());
  const [matches, setMatches] = useState<GblMatch[] | null>(null);
  const [error, setError] = useState("");
  const [league, setLeague] = useState<GblLeague>("great");

  useEffect(() => {
    const sync = () => setPlayer(playerFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError("");
    loadGblMatches()
      .then((rows) => {
        if (!cancelled) setMatches(rows);
      })
      .catch(() => {
        if (!cancelled) setError("対戦記録を読み込めませんでした。");
      });
    return () => {
      cancelled = true;
    };
  }, [player]);

  const players = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of matches ?? []) counts.set(row.player, (counts.get(row.player) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja"));
  }, [matches]);

  const rows = useMemo(() => {
    return (matches ?? [])
      .filter((row) => row.player === player && row.league === league)
      .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  }, [league, matches, player]);

  return (
    <div className="page-iv gbl-page">
      <div className="page-heading">
        {player ? (
          <a className="btn btn-secondary btn-back" href="#/research/gbl">
            <ArrowLeft size={16} />
            プレイヤー
          </a>
        ) : (
          <a className="btn btn-secondary btn-back" href="#/">
            <ArrowLeft size={16} />
            ホーム
          </a>
        )}
        <div>
          <h1>{player ?? "GBLパーティ振り返り"}</h1>
          <p className="page-lead">
            {player ? "リーグを選ぶと、その対戦記録が出ます。" : "記録のあるプレイヤーを選びます。"}
          </p>
        </div>
      </div>

      {error ? (
        <section className="panel">
          <p className="page-lead">{error}</p>
        </section>
      ) : null}

      {!matches && !error ? (
        <section className="panel" aria-busy="true">
          <p className="page-lead">対戦記録を読み込み中です。</p>
        </section>
      ) : null}

      {matches && !player ? (
        <div className="gbl-players" role="list">
          {players.length === 0 ? <p className="note">まだ対戦記録がありません。</p> : null}
          {players.map(([name, count]) => (
            <a key={name} className="gbl-player" role="listitem" href={`#/research/gbl/${encodeURIComponent(name)}`}>
              <span>{name}</span>
              <span className="gbl-player-count num">{count}</span>
            </a>
          ))}
        </div>
      ) : null}

      {matches && player ? (
        <>
          <div className="choice-row league-row" role="group" aria-label="リーグ">
            {LEAGUES.map((item) => (
              <LeagueIconButton
                key={item.id}
                id={item.id as LeagueMarkId}
                label={item.label}
                pressed={league === item.id}
                onClick={() => setLeague(item.id)}
              />
            ))}
          </div>
          {rows.length === 0 ? <p className="note">このリーグの記録はまだありません。</p> : null}
          <div className="gbl-log" role="list">
            {rows.map((row) => (
              <article key={row.id} className="gbl-row" role="listitem">
                <span className={row.result === "win" ? "gbl-result is-win" : "gbl-result is-loss"}>
                  {row.result === "win" ? "勝" : "負"}
                </span>
                <Party mons={row.self} label="自分" side="self" />
                <span className="gbl-vs">対</span>
                <Party mons={row.opponent} label="相手" side="foe" />
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Party({ mons, label, side }: { mons: GblMon[]; label: string; side: "self" | "foe" }) {
  return (
    <div className={`gbl-party is-${side}`} aria-label={label}>
      {mons.map((mon, index) => (
        <span className="gbl-mon" key={`${mon.id}-${index}`}>
          <PokemonDotSprite pokemonId={mon.id} form={mon.form} alt="" size={28} />
          <span className="gbl-mon-name">{mon.name}</span>
        </span>
      ))}
    </div>
  );
}
