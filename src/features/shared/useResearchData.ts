import { useEffect, useMemo, useState } from "react";
import { applyMoveEdits, loadMoveEdits, subscribeMoveEdits } from "../../lib/pogo/moveEdits";
import { applyKu6Learnsets, type SheetCatalog } from "../../lib/pogo/ku6Learnsets";
import type { PvpBundle } from "../../lib/pogo/pvpBundle";
import {
  buildCpMultiplierMap,
  groupSpecies,
  type CpMultiplierRecord,
  type PogoStatRecord,
} from "../../lib/pogo/research";

export type ResearchData = {
  stats: PogoStatRecord[];
  multipliers: CpMultiplierRecord[];
  bundle: PvpBundle;
};

export function useResearchData() {
  const [data, setData] = useState<ResearchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editVersion, setEditVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setData(null);
      try {
        const [statsRes, cpmRes, bundleRes, catalogRes] = await Promise.all([
          fetch("/data/pokemon_stats.json"),
          fetch("/data/cp_multiplier.json"),
          fetch("/data/pvp_bundle.json"),
          fetch("/data/sheet_catalog.json"),
        ]);
        if (!statsRes.ok || !cpmRes.ok || !bundleRes.ok || !catalogRes.ok) {
          throw new Error("data fetch failed");
        }
        const stats = (await statsRes.json()) as PogoStatRecord[];
        const multipliers = (await cpmRes.json()) as CpMultiplierRecord[];
        let bundle = (await bundleRes.json()) as PvpBundle;
        const catalog = (await catalogRes.json()) as SheetCatalog;
        bundle = applyKu6Learnsets(bundle, catalog, stats);
        if (!cancelled) setData({ stats, multipliers, bundle });
      } catch {
        if (!cancelled) setError("研究データの読み込みに失敗しました。");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => subscribeMoveEdits(() => setEditVersion((value) => value + 1)), []);

  const edited = useMemo(() => {
    if (!data) return null;
    return { ...data, bundle: applyMoveEdits(data.bundle, loadMoveEdits()) };
  }, [data, editVersion]);

  const speciesGroups = useMemo(() => (edited ? groupSpecies(edited.stats) : []), [edited]);
  const cpData = useMemo(() => (edited ? buildCpMultiplierMap(edited.multipliers) : null), [edited]);

  return {
    data: edited,
    error,
    speciesGroups,
    cpData,
    reload: () => setReloadKey((value) => value + 1),
  };
}
