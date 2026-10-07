import { useEffect, useRef, useState } from "react";
import { groupSpecies, type PogoStatRecord, type SpeciesGroup } from "../../lib/pogo/research";
import { recordPokemonPick, refreshGlobalCounts, usePokemonPicks } from "../../lib/pogo/pokemonPicks";
import { PokemonSearchDialog } from "./PokemonSearchDialog";
import { bindPokemonSearch } from "./pokemonSearchApi";

export function PokemonSearchHost() {
  const [groups, setGroups] = useState<SpeciesGroup[]>([]);
  const [open, setOpen] = useState(false);
  const onSelectRef = useRef<(group: SpeciesGroup) => void>(() => undefined);
  const { counts } = usePokemonPicks();

  useEffect(() => {
    let cancelled = false;
    void refreshGlobalCounts();
    void fetch("/data/pokemon_stats.json")
      .then((response) => response.json())
      .then((stats: PogoStatRecord[]) => {
        if (!cancelled) setGroups(groupSpecies(stats));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return bindPokemonSearch((onSelect) => {
      onSelectRef.current = onSelect;
      setOpen(true);
    });
  }, []);

  return (
    <PokemonSearchDialog
      open={open}
      groups={groups}
      counts={counts}
      onClose={() => setOpen(false)}
      onSelect={(group) => {
        recordPokemonPick(group.pokemonId);
        onSelectRef.current(group);
        setOpen(false);
      }}
    />
  );
}
