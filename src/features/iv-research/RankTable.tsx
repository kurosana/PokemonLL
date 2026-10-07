import { useEffect, useMemo, useRef, useState } from "react";
import type { RankingRow } from "../../lib/pogo/research";

const FILTERS = [
  { label: "100位以内", limit: 100 },
  { label: "300位以内", limit: 300 },
  { label: "500位以内", limit: 500 },
  { label: "1000位以内", limit: 1000 },
  { label: "すべて", limit: null },
] as const;

type SortKey = "rank" | "iv" | "attack" | "defense" | "stamina" | "level" | "cp";
type SortDir = "asc" | "desc" | null;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "順位" },
  { key: "iv", label: "IV" },
  { key: "attack", label: "攻撃" },
  { key: "defense", label: "防御" },
  { key: "stamina", label: "HP" },
  { key: "level", label: "Lv" },
  { key: "cp", label: "CP" },
];

export function RankTable({ rows, current }: { rows: RankingRow[]; current: RankingRow | null }) {
  const [limit, setLimit] = useState<number | null>(100);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const [pinBottom, setPinBottom] = useState(false);

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => limit === null || row.rank <= limit);
    if (!sortDir) return filtered;
    const sorted = [...filtered].sort((a, b) => compareRows(a, b, sortKey) * (sortDir === "asc" ? 1 : -1));
    return sorted;
  }, [limit, rows, sortDir, sortKey]);

  const currentInList = current
    ? visible.some((row) => row.atkIv === current.atkIv && row.defIv === current.defIv && row.staIv === current.staIv)
    : false;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const update = () => {
      const row = currentRef.current;
      if (!row) {
        setPinBottom(false);
        return;
      }
      const top = row.offsetTop;
      const viewBottom = scroller.scrollTop + scroller.clientHeight;
      setPinBottom(top >= viewBottom - 1);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [visible, current]);

  const cycleSort = (key: SortKey) => {
    if (sortKey !== key || sortDir === null) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortDir("asc");
      return;
    }
    setSortDir(null);
    setSortKey("rank");
  };

  return (
    <div className="rank-board">
      <div className="rank-filters" role="group" aria-label="順位の絞り込み">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className={`choice${filter.limit === limit ? " is-pressed" : ""}`}
            aria-pressed={filter.limit === limit}
            onClick={() => setLimit(filter.limit)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {current && !currentInList ? (
        <p className="rank-outside">この個体は #{current.rank} で、いまの絞り込みの外です。</p>
      ) : null}
      <div className="rank-grid rank-head" role="row">
        {COLUMNS.map((column) => {
          const active = sortDir && sortKey === column.key;
          const mark = !active ? "" : sortDir === "desc" ? " ↓" : " ↑";
          return (
            <button key={column.key} type="button" onClick={() => cycleSort(column.key)}>
              {column.label}
              {mark}
            </button>
          );
        })}
      </div>
      <div className="rank-scroll" ref={scrollerRef}>
        {visible.map((row) => {
          const isCurrent =
            current?.atkIv === row.atkIv && current.defIv === row.defIv && current.staIv === row.staIv;
          return (
            <div
              key={`${row.atkIv}-${row.defIv}-${row.staIv}`}
              ref={isCurrent ? currentRef : undefined}
              className={`rank-grid rank-line${isCurrent ? " is-current" : ""}`}
            >
              <RankCells row={row} />
            </div>
          );
        })}
        {pinBottom && current ? (
          <div className="rank-pin-bottom" aria-hidden="true">
            <div className="rank-grid rank-line is-current">
              <RankCells row={current} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RankCells({ row }: { row: RankingRow }) {
  return (
    <>
      <span>#{row.rank}</span>
      <span>
        {row.atkIv}/{row.defIv}/{row.staIv}
      </span>
      <span>{row.attack.toFixed(1)}</span>
      <span>{row.defense.toFixed(1)}</span>
      <span>{row.stamina}</span>
      <span>{row.level.toFixed(1)}</span>
      <span>{row.cp}</span>
    </>
  );
}

function compareRows(a: RankingRow, b: RankingRow, key: SortKey) {
  if (key === "iv") {
    return a.atkIv - b.atkIv || a.defIv - b.defIv || a.staIv - b.staIv;
  }
  return a[key] - b[key];
}
