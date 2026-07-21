# TradeUp Gen

A CS2 trade-up contract finder with live market prices, float analysis, and expected value calculations.

## Features

- **Trade-up generator** — Find contracts matching your target ROI, price range, and complexity
- **Live pricing** — Steam Community Market prices (optional SteamApis bulk key)
- **Float complexity** — Simple (wear tier), Moderate (max float cap), or Precise (exact floats)
- **Outcome analysis** — See every possible output with probability and profit/loss
- **Save trade-ups** — Persist favorites via localStorage
- **AI insights** — Optional OpenRouter-powered contract analysis
- **Responsive design** — Optimized layouts for mobile and desktop

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CSFLOAT_API_KEY` | No | CSFloat API key for enhanced data |
| `STEAMAPIS_API_KEY` | No | SteamApis key for bulk Steam Market prices |
| `OPENROUTER_API_KEY` | No | OpenRouter key for AI trade-up insights |

Without `STEAMAPIS_API_KEY`, prices are fetched individually from Steam Community Market (slower but works out of the box).

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## How Trade-Ups Work

- 10 skins of the same rarity → 1 skin of the next tier up
- Output float = average normalized input float mapped to output range
- Probability = (inputs from collection / 10) × (1 / outputs in that collection)
- Expected value = Σ(probability × output price × (1 - fee))

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- CSFloat Schema API
- Steam Community Market API
