import type { SpeciesGroup } from "../../lib/pogo/research";

type OpenSearch = (onSelect: (group: SpeciesGroup) => void) => void;

let openSearchImpl: OpenSearch | null = null;

export function bindPokemonSearch(openSearch: OpenSearch) {
  openSearchImpl = openSearch;
  return () => {
    if (openSearchImpl === openSearch) openSearchImpl = null;
  };
}

/** 個体値以外の画面からも同じ検索オーバーレイを開く。 */
export function openPokemonSearch(onSelect: (group: SpeciesGroup) => void) {
  openSearchImpl?.(onSelect);
}
