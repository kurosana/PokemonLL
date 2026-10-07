const DOT_SPRITE_SIZE = 64;

export function pokemonDotSpritePath(pokemonId: number) {
  const id = Math.max(1, Math.floor(pokemonId));
  return `/assets/pokemon/dot/${String(id).padStart(4, "0")}.svg`;
}

export function pokemonDotSpriteSize() {
  return DOT_SPRITE_SIZE;
}
