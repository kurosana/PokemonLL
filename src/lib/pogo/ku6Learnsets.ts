import type { PogoStatRecord } from "./research";
import type { PvpBundle } from "./pvpBundle";

export type SheetCatalogEntry = {
  key: string;
  dex: number;
  fastIds: (string | null)[];
  chargedIds: (string | null)[];
};

export type SheetCatalog = {
  pokemon: SheetCatalogEntry[];
};

function uniqueIds(ids: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sortCatalogKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const suffix = (key: string) => (key.includes("-") ? Number(key.split("-")[1]) || 99 : 0);
    const diff = suffix(a) - suffix(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

function formsForDex(stats: PogoStatRecord[], pokemonId: number) {
  const forms = stats.filter((row) => row.pokemon_id === pokemonId).map((row) => row.form);
  return [...new Set(forms)].sort((a, b) => {
    if (a === "Normal") return -1;
    if (b === "Normal") return 1;
    return a.localeCompare(b, "ja");
  });
}

function catalogKeyFor(pokemonId: number, form: string, keysByDex: Map<number, string[]>, stats: PogoStatRecord[]) {
  const keys = sortCatalogKeys(keysByDex.get(pokemonId) ?? []);
  if (!keys.length) return null;
  if (keys.length === 1) return keys[0];

  const forms = formsForDex(stats, pokemonId);
  const formIndex = forms.indexOf(form);
  const baseKey = keys.find((key) => !key.includes("-")) ?? keys[0];
  if (form === "Normal" || formIndex <= 0) return baseKey;

  const altKeys = keys.filter((key) => key.includes("-"));
  const altIndex = forms.includes("Normal") ? formIndex - 1 : formIndex;
  return altKeys[altIndex] ?? keys[Math.min(formIndex, keys.length - 1)] ?? baseKey;
}

export function applyKu6Learnsets(bundle: PvpBundle, catalog: SheetCatalog, stats: PogoStatRecord[]): PvpBundle {
  const keysByDex = new Map<number, string[]>();
  for (const row of catalog.pokemon) {
    const list = keysByDex.get(row.dex) ?? [];
    list.push(row.key);
    keysByDex.set(row.dex, list);
  }

  const byKey = new Map(catalog.pokemon.map((row) => [row.key, row]));
  const pokemon = bundle.pokemon.map((entry) => {
    const key = catalogKeyFor(entry.pokemonId, entry.form, keysByDex, stats);
    if (!key) return entry;
    const sheet = byKey.get(key);
    if (!sheet) return entry;
    const fast = uniqueIds(sheet.fastIds);
    const charged = uniqueIds(sheet.chargedIds);
    if (!fast.length && !charged.length) return entry;
    return {
      ...entry,
      fast: fast.length ? fast : entry.fast,
      charged: charged.length ? charged : entry.charged,
    };
  });

  return { ...bundle, pokemon };
}
