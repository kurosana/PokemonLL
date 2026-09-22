export const PVP_TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export type PvpType = (typeof PVP_TYPES)[number];

export const TYPE_LABEL_JA: Record<PvpType, string> = {
  normal: "ノーマル",
  fire: "ほのお",
  water: "みず",
  electric: "でんき",
  grass: "くさ",
  ice: "こおり",
  fighting: "かくとう",
  poison: "どく",
  ground: "じめん",
  flying: "ひこう",
  psychic: "エスパー",
  bug: "むし",
  rock: "いわ",
  ghost: "ゴースト",
  dragon: "ドラゴン",
  dark: "あく",
  steel: "はがね",
  fairy: "フェアリー",
};

const SE = 1.6;
const NVE = 0.625;
const IMM = 0.390625;

const TYPE_CHART: Record<PvpType, Partial<Record<PvpType, number>>> = {
  normal: { rock: NVE, ghost: IMM, steel: NVE },
  fire: { fire: NVE, water: NVE, grass: SE, ice: SE, bug: SE, rock: NVE, dragon: NVE, steel: SE },
  water: { fire: SE, water: NVE, grass: NVE, ground: SE, rock: SE, dragon: NVE },
  electric: { water: SE, electric: NVE, grass: NVE, ground: IMM, flying: SE, dragon: NVE },
  grass: {
    fire: NVE,
    water: SE,
    grass: NVE,
    poison: NVE,
    ground: SE,
    flying: NVE,
    bug: NVE,
    rock: SE,
    dragon: NVE,
    steel: NVE,
  },
  ice: { fire: NVE, water: NVE, grass: SE, ice: NVE, ground: SE, flying: SE, dragon: SE, steel: NVE },
  fighting: {
    normal: SE,
    ice: SE,
    poison: NVE,
    flying: NVE,
    psychic: NVE,
    bug: NVE,
    rock: SE,
    ghost: IMM,
    dark: SE,
    steel: SE,
    fairy: NVE,
  },
  poison: { grass: SE, poison: NVE, ground: NVE, rock: NVE, ghost: NVE, steel: IMM, fairy: SE },
  ground: { fire: SE, electric: SE, grass: NVE, poison: SE, flying: IMM, bug: NVE, rock: SE, steel: SE },
  flying: { electric: NVE, grass: SE, fighting: SE, bug: SE, rock: NVE, steel: NVE },
  psychic: { fighting: SE, poison: SE, psychic: NVE, dark: IMM, steel: NVE },
  bug: {
    fire: NVE,
    grass: SE,
    fighting: NVE,
    poison: NVE,
    flying: NVE,
    psychic: SE,
    ghost: NVE,
    dark: SE,
    steel: NVE,
    fairy: NVE,
  },
  rock: { fire: SE, ice: SE, fighting: NVE, ground: NVE, flying: SE, bug: SE, steel: NVE },
  ghost: { normal: IMM, psychic: SE, ghost: SE, dark: NVE },
  dragon: { dragon: SE, steel: NVE, fairy: IMM },
  dark: { fighting: NVE, psychic: SE, ghost: SE, dark: NVE, fairy: NVE },
  steel: { fire: NVE, water: NVE, electric: NVE, ice: SE, rock: SE, steel: NVE, fairy: SE },
  fairy: { fire: NVE, fighting: SE, poison: NVE, dragon: SE, dark: SE, steel: NVE },
};

export function asPvpType(value: string): PvpType {
  const normalized = value.toLowerCase() as PvpType;
  return PVP_TYPES.includes(normalized) ? normalized : "normal";
}

export function typeEffectiveness(moveType: string, defenderTypes: string[]) {
  const attack = asPvpType(moveType);
  return defenderTypes.reduce((product, defenderType) => {
    const multiplier = TYPE_CHART[attack][asPvpType(defenderType)] ?? 1;
    return product * multiplier;
  }, 1);
}

export function stabMultiplier(moveType: string, attackerTypes: string[]) {
  return attackerTypes.some((type) => asPvpType(type) === asPvpType(moveType)) ? 1.2 : 1;
}

export function buffMultiplier(stage: number) {
  const clamped = Math.max(-4, Math.min(4, stage));
  if (clamped >= 0) return (4 + clamped) / 4;
  return 4 / (4 - clamped);
}
