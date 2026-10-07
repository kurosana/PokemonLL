# PokemonLL

ポケモンGOバトル研究用の仲間内Webアプリケーションです。まずはCloudflare Pagesで無料運用しやすい静的フロントエンドとして構成しています。

## Push

@クロサナ

## Commands

```bash
npm install
npm run generate:pokemon-names
npm run generate:placeholder-sprites
npm run dev
npm run build
```

## Structure

- `src/app/`: app bootstrap and route switching
- `src/features/home/`: home screen
- `src/features/iv-research/`: individual research page
- `src/lib/pogo/`: shared Pokemon GO domain logic and generated name map
- `scripts/`: data-generation scripts
- `public/assets/pokemon/dot/`: 64×64 placeholder dot sprites (`{pokemonId}.svg`). Replace with real art using the same filenames (PNG/SVG).

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
