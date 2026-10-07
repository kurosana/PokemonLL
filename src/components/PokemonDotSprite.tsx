import React from "react";
import { pokemonDexImagePath, pokemonDexPlaceholderPath, pokemonDotSpriteSize } from "../lib/pogo/pokemonSprite";

type PokemonDotSpriteProps = {
  pokemonId: number;
  alt: string;
  size?: number;
  className?: string;
  /** 図鑑画像の拡張子（デフォルト png） */
  extension?: string;
};

export function PokemonDotSprite({
  pokemonId,
  alt,
  size = 40,
  className,
  extension = "png",
}: PokemonDotSpriteProps) {
  const primary = pokemonDexImagePath(pokemonId, extension);
  const fallback = pokemonDexPlaceholderPath();
  const intrinsic = pokemonDotSpriteSize();
  const [src, setSrc] = React.useState(primary);

  React.useEffect(() => {
    setSrc(primary);
  }, [primary]);

  return (
    <img
      className={className ? `pokemon-dot-sprite ${className}` : "pokemon-dot-sprite"}
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{ width: size, height: size }}
      data-intrinsic-size={intrinsic}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}
