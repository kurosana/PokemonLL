import { pokemonDotSpritePath, pokemonDotSpriteSize } from "../lib/pogo/pokemonSprite";

type PokemonDotSpriteProps = {
  pokemonId: number;
  alt: string;
  size?: number;
  className?: string;
};

export function PokemonDotSprite({ pokemonId, alt, size = 40, className }: PokemonDotSpriteProps) {
  const src = pokemonDotSpritePath(pokemonId);
  const intrinsic = pokemonDotSpriteSize();

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
    />
  );
}
