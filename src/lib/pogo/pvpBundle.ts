import type { PvpMove } from "./combat";

export type PvpPokemonRecord = {
  pokemonId: number;
  name: string;
  form: string;
  types: string[];
  fast: string[];
  charged: string[];
};

export type PvpBundle = {
  moves: Record<string, PvpMove>;
  pokemon: PvpPokemonRecord[];
};

export function findPvpPokemon(bundle: PvpBundle, pokemonId: number, form: string) {
  return (
    bundle.pokemon.find((entry) => entry.pokemonId === pokemonId && entry.form === form) ??
    bundle.pokemon.find((entry) => entry.pokemonId === pokemonId && entry.form === "Normal") ??
    bundle.pokemon.find((entry) => entry.pokemonId === pokemonId) ??
    null
  );
}

export function resolveMoves(bundle: PvpBundle, ids: string[]) {
  return ids.map((id) => bundle.moves[id]).filter((move): move is PvpMove => Boolean(move));
}
