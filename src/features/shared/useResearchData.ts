import { useEffect, useMemo, useState } from "react";
import {
  buildCpMultiplierMap,
  groupSpecies,
  type CpMultiplierRecord,
  type PogoStatRecord,
} from "../../lib/pogo/research";
import type { PvpBundle } from "../../lib/pogo/pvpBundle";

export type ResearchData = {
  stats: PogoStatRecord[];
  multipliers: CpMultiplierRecord[];
  bundle: PvpBundle;
};

export function useResearchData() {
  const [data, setData] = useState<ResearchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setData(null);
      try {
        const [statsRes, cpmRes, bundleRes] = await Promise.all([
          fetch("/data/pokemon_stats.json"),
          fetch("/data/cp_multiplier.json"),
          fetch("/data/pvp_bundle.json"),
        ]);
        if (!statsRes.ok || !cpmRes.ok || !bundleRes.ok) {
          throw new Error("data fetch failed");
        }
        const stats = (await statsRes.json()) as PogoStatRecord[];
        const multipliers = (await cpmRes.json()) as CpMultiplierRecord[];
        const bundle = (await bundleRes.json()) as PvpBundle;
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

  const speciesGroups = useMemo(() => (data ? groupSpecies(data.stats) : []), [data]);
  const cpData = useMemo(() => (data ? buildCpMultiplierMap(data.multipliers) : null), [data]);

  return {
    data,
    error,
    speciesGroups,
    cpData,
    reload: () => setReloadKey((value) => value + 1),
  };
}
