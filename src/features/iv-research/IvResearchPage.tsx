import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ListFilter, Search } from "lucide-react";
import {
  buildCpMultiplierMap,
  computeBestRankings,
  computeDerivedStats,
  formatFormLabel,
  getPokemonDisplayName,
  groupSpecies,
  leagueConfigs,
  type CpMultiplierRecord,
  type LeagueId,
  type PogoStatRecord,
  type RankingRow,
  type SpeciesGroup,
} from "../../lib/pogo/research";

type LoadedData = {
  stats: PogoStatRecord[];
  multipliers: CpMultiplierRecord[];
};

const IV_PRESETS = [
  { label: "0 / 15 / 15", atk: 0, def: 15, sta: 15 },
  { label: "15 / 15 / 15", atk: 15, def: 15, sta: 15 },
] as const;

function leagueCap(leagueId: LeagueId, customCap: number) {
  if (leagueId === "custom") return customCap;
  return leagueConfigs.find((league) => league.id === leagueId)?.cap ?? 1500;
}

function pickPreferredEntry(group: SpeciesGroup) {
  return group.entries.find((entry) => entry.form === "Normal") ?? group.entries[0];
}

function speciesDisplayName(group: SpeciesGroup) {
  return getPokemonDisplayName(group.pokemonId, group.name);
}

function formatStat(value: number) {
  return value.toLocaleString("ja-JP", {
    maximumFractionDigits: 2,
  });
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function ivTone(value: number) {
  if (value >= 13) return "high";
  if (value <= 2) return "low";
  return "mid";
}

export function IvResearchPage() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState("");
  const [selectedForm, setSelectedForm] = useState("");
  const [leagueId, setLeagueId] = useState<LeagueId>("great");
  const [customCap, setCustomCap] = useState(1500);
  const [level, setLevel] = useState(50);
  const [atkIv, setAtkIv] = useState(0);
  const [defIv, setDefIv] = useState(15);
  const [staIv, setStaIv] = useState(15);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setData(null);

      try {
        const [statsRes, cpmRes] = await Promise.all([
          fetch("/data/pokemon_stats.json"),
          fetch("/data/cp_multiplier.json"),
        ]);

        if (!statsRes.ok || !cpmRes.ok) {
          throw new Error("data fetch failed");
        }

        const stats = (await statsRes.json()) as PogoStatRecord[];
        const multipliers = (await cpmRes.json()) as CpMultiplierRecord[];

        if (!cancelled) {
          setData({ stats, multipliers });
        }
      } catch {
        if (!cancelled) {
          setError("種族値データの読み込みに失敗しました。");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const speciesGroups = useMemo(() => {
    if (!data) return [];
    return groupSpecies(data.stats);
  }, [data]);

  useEffect(() => {
    if (!speciesGroups.length) return;
    if (!selectedSpecies) {
      const preferred = speciesGroups[0];
      const entry = pickPreferredEntry(preferred);
      setSelectedSpecies(preferred.name);
      setSelectedForm(entry.form);
    }
  }, [selectedSpecies, speciesGroups]);

  const filteredSpecies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return speciesGroups.slice(0, 40);

    return speciesGroups
      .filter((group) => {
        const englishName = group.name.toLowerCase();
        const japaneseName = speciesDisplayName(group).toLowerCase();
        const formMatch = group.entries.some((entry) => entry.form.toLowerCase().includes(normalizedQuery));
        return englishName.includes(normalizedQuery) || japaneseName.includes(normalizedQuery) || formMatch;
      })
      .slice(0, 40);
  }, [query, speciesGroups]);

  useEffect(() => {
    if (!selectedSpecies || !speciesGroups.length) return;
    const group = speciesGroups.find((item) => item.name === selectedSpecies);
    if (!group) return;
    if (!group.entries.some((entry) => entry.form === selectedForm)) {
      setSelectedForm(pickPreferredEntry(group).form);
    }
  }, [selectedForm, selectedSpecies, speciesGroups]);

  const selectedGroup = useMemo(() => {
    if (!selectedSpecies) return null;
    return speciesGroups.find((group) => group.name === selectedSpecies) ?? null;
  }, [selectedSpecies, speciesGroups]);

  const selectedEntry = useMemo(() => {
    if (!selectedGroup) return null;
    return selectedGroup.entries.find((entry) => entry.form === selectedForm) ?? pickPreferredEntry(selectedGroup);
  }, [selectedForm, selectedGroup]);

  const cpData = useMemo(() => {
    if (!data) return null;
    return buildCpMultiplierMap(data.multipliers);
  }, [data]);

  const cap = leagueCap(leagueId, customCap);

  const allRankings = useMemo(() => {
    if (!selectedEntry || !cpData) return [];
    return computeBestRankings(selectedEntry, cpData.levels, cpData.byLevel, cap);
  }, [cap, cpData, selectedEntry]);

  const rankings = useMemo(() => allRankings.slice(0, 24), [allRankings]);

  const currentStats = useMemo(() => {
    if (!selectedEntry || !cpData) return null;
    const multiplier = cpData.byLevel.get(level.toFixed(1));
    if (multiplier === undefined) return null;
    return computeDerivedStats(selectedEntry, atkIv, defIv, staIv, multiplier);
  }, [atkIv, cpData, defIv, level, selectedEntry, staIv]);

  const currentRank = useMemo(() => {
    if (!currentStats || !allRankings.length) return null;
    return (
      allRankings.find((row) => row.atkIv === atkIv && row.defIv === defIv && row.staIv === staIv) ?? null
    );
  }, [atkIv, allRankings, defIv, currentStats, staIv]);

  const applyRanking = (row: RankingRow) => {
    setAtkIv(row.atkIv);
    setDefIv(row.defIv);
    setStaIv(row.staIv);
    setLevel(row.level);
  };

  return (
    <div className="page-iv">
      <div className="page-heading">
        <a className="btn btn-secondary btn-back" href="#/">
          <ArrowLeft size={16} />
          ホーム
        </a>
        <div>
          <h1>個体値研究</h1>
          <p className="page-lead">
            ポケモンを選んで、リーグと個体値を入れると CP と順位が出ます。ランキングの行を押すと、その個体値が入ります。
          </p>
        </div>
      </div>

      {error ? (
        <section className="panel">
          <h2 className="panel-title">データを読み込めませんでした</h2>
          <p className="page-lead">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => setReloadKey((value) => value + 1)}>
            再読み込み
          </button>
        </section>
      ) : null}

      {!data && !error ? (
        <section className="panel" aria-busy="true" aria-live="polite">
          <p className="page-lead">種族値データを読み込み中です。</p>
          <div className="skeleton-stack" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      ) : null}

      {data ? (
        <div className="iv-workspace">
          <aside className="panel picker-panel">
            <h2 className="panel-title">
              <Search size={16} />
              ポケモンを探す
            </h2>
            <label className="field">
              <span className="field-label">名前・フォルム</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ピカチュウ、メガ、シャドウ…"
                className="input"
                type="search"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="species-list" role="listbox" aria-label="ポケモン一覧">
              {filteredSpecies.length === 0 ? (
                <p className="empty-note">一致するポケモンがありません。名前を変えて検索してください。</p>
              ) : (
                filteredSpecies.map((group) => {
                  const isSelected = group.name === selectedSpecies;
                  return (
                    <button
                      key={group.name}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`species-item${isSelected ? " is-selected" : ""}`}
                      onClick={() => {
                        setSelectedSpecies(group.name);
                        setSelectedForm(pickPreferredEntry(group).form);
                      }}
                    >
                      <span className="species-name">{speciesDisplayName(group)}</span>
                      <span className="species-meta">
                        No.{String(group.pokemonId).padStart(4, "0")}
                        {group.entries.length > 1 ? ` · ${group.entries.length}フォルム` : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div className="iv-results">
            <section className="panel">
              <div className="selected-head">
                <div>
                  <p className="eyebrow">選択中</p>
                  <h2 className="selected-name">
                    {selectedGroup ? speciesDisplayName(selectedGroup) : "ポケモンを選んでください"}
                  </h2>
                  {selectedEntry ? (
                    <p className="note">
                      種族値 {selectedEntry.base_attack} / {selectedEntry.base_defense} / {selectedEntry.base_stamina}
                    </p>
                  ) : null}
                </div>
                <p className="dex-no num">
                  {selectedGroup ? `No.${String(selectedGroup.pokemonId).padStart(4, "0")}` : ""}
                </p>
              </div>

              {selectedGroup && selectedGroup.entries.length > 1 ? (
                <div className="choice-row" role="group" aria-label="フォルム">
                  {selectedGroup.entries.map((entry) => (
                    <button
                      key={entry.form}
                      type="button"
                      className="choice"
                      aria-pressed={entry.form === selectedForm}
                      onClick={() => setSelectedForm(entry.form)}
                    >
                      {formatFormLabel(entry.form)}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="choice-row" role="group" aria-label="リーグ">
                {leagueConfigs.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    className="choice"
                    aria-pressed={league.id === leagueId}
                    onClick={() => setLeagueId(league.id)}
                  >
                    {league.label}
                  </button>
                ))}
              </div>

              {leagueId === "custom" ? (
                <label className="field">
                  <span className="field-label">CP上限</span>
                  <input
                    className="input"
                    type="number"
                    min={10}
                    max={9999}
                    inputMode="numeric"
                    value={customCap}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      setCustomCap(next);
                    }}
                    onBlur={() => setCustomCap(clampNumber(Math.round(customCap), 10, 9999, 1500))}
                  />
                </label>
              ) : (
                <p className="note">CP上限 {cap.toLocaleString("ja-JP")}</p>
              )}
            </section>

            <section className="panel">
              <h2 className="panel-title">
                <ListFilter size={16} />
                個体値とレベル
              </h2>
              <div className="iv-controls">
                <IvField label="攻撃IV" value={atkIv} tone={ivTone(atkIv)} onChange={setAtkIv} />
                <IvField label="防御IV" value={defIv} tone={ivTone(defIv)} onChange={setDefIv} />
                <IvField label="HP IV" value={staIv} tone={ivTone(staIv)} onChange={setStaIv} />
              </div>
              <div className="preset-row">
                {IV_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="choice choice-compact"
                    onClick={() => {
                      setAtkIv(preset.atk);
                      setDefIv(preset.def);
                      setStaIv(preset.sta);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label className="field">
                <span className="field-label">レベル {level.toFixed(1)}</span>
                <input
                  className="level-range"
                  type="range"
                  min={1}
                  max={50}
                  step={0.5}
                  value={level}
                  onChange={(event) => setLevel(Number(event.target.value))}
                />
              </label>
            </section>

            <section className="panel result-panel">
              <h2 className="panel-title">この個体</h2>
              <div className="hero-stats">
                <div>
                  <span>順位</span>
                  <strong className="hero-rank num">{currentRank ? `#${currentRank.rank}` : "—"}</strong>
                </div>
                <div>
                  <span>CP</span>
                  <strong className="hero-cp num">{currentStats ? currentStats.cp.toLocaleString("ja-JP") : "—"}</strong>
                </div>
              </div>
              <div className="stat-grid">
                <div>
                  <span>攻撃</span>
                  <strong className="num">{currentStats ? formatStat(currentStats.attack) : "—"}</strong>
                </div>
                <div>
                  <span>防御</span>
                  <strong className="num">{currentStats ? formatStat(currentStats.defense) : "—"}</strong>
                </div>
                <div>
                  <span>HP</span>
                  <strong className="num">{currentStats ? formatStat(currentStats.stamina) : "—"}</strong>
                </div>
                <div>
                  <span>SCP</span>
                  <strong className="num">
                    {currentStats ? Math.round(currentStats.statProduct).toLocaleString("ja-JP") : "—"}
                  </strong>
                </div>
              </div>
              {currentRank && currentRank.level !== level ? (
                <p className="note">この個体値の最適レベルは {currentRank.level.toFixed(1)} です。ランキングの行を押すとそのレベルに合わせられます。</p>
              ) : null}
            </section>

            <section className="panel">
              <h2 className="panel-title">ランキング上位</h2>
              <p className="note">行を押すと、その個体値と最適レベルが入ります。</p>
              <div className="ranking-head num" aria-hidden="true">
                <span>順位</span>
                <span>IV</span>
                <span>Lv</span>
                <span>CP</span>
              </div>
              <div className="ranking-list">
                {rankings.map((row) => {
                  const isCurrent = currentRank?.rank === row.rank;
                  return (
                    <button
                      key={`${row.rank}-${row.atkIv}-${row.defIv}-${row.staIv}`}
                      type="button"
                      className={`ranking-row${isCurrent ? " is-current" : ""}`}
                      onClick={() => applyRanking(row)}
                    >
                      <span className="ranking-no num">#{row.rank}</span>
                      <span className="ranking-iv num">
                        {row.atkIv}/{row.defIv}/{row.staIv}
                      </span>
                      <span className="num">{row.level.toFixed(1)}</span>
                      <span className="num">{row.cp}</span>
                    </button>
                  );
                })}
              </div>
              {currentRank && currentRank.rank > rankings.length ? (
                <p className="note">
                  この個体は #{currentRank.rank} です。上位 {rankings.length} 件の外にあります。
                </p>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IvField({
  label,
  value,
  tone,
  onChange,
}: {
  label: string;
  value: number;
  tone: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const next = clampNumber(Math.round(Number(raw)), 0, 15, 0);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className={`input iv-input iv-${tone}`}
        type="number"
        min={0}
        max={15}
        inputMode="numeric"
        value={draft}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw === "") return;
          const next = Number(raw);
          if (!Number.isFinite(next)) return;
          onChange(clampNumber(Math.round(next), 0, 15, value));
        }}
        onBlur={() => commit(draft)}
      />
    </label>
  );
}
