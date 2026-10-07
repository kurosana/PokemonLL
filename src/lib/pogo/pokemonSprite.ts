const DOT_SPRITE_SIZE = 64;

/** ルートの `Image/` に置く図鑑番号ファイル（拡張子は png / svg / webp など） */
export function pokemonDexImagePath(pokemonId: number, extension = "png") {
  const id = Math.max(1, Math.floor(pokemonId));
  const dex = String(id).padStart(4, "0");
  return `/Image/${dex}.${extension}`;
}

/** 図鑑画像が無いときの共通プレースホルダ（1枚だけ） */
export function pokemonDexPlaceholderPath() {
  return "/Image/placeholder.svg";
}

export function pokemonDotSpriteSize() {
  return DOT_SPRITE_SIZE;
}
