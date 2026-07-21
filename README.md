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
| `STEAMAPIS_API_KEY` | **Recommended** | Bulk Steam Market sale prices |
| `OPENROUTER_API_KEY` | Optional | AI trade-up insights (~$0.0002 per click) |
| `OPENROUTER_MODEL` | Optional | AI model override (default: `google/gemini-2.5-flash-lite`) |

### Do I need other APIs?

**No — SteamApis alone is enough for pricing.** The app automatically uses Skinport as a free backup (no key required) when merging prices. OpenRouter is only for optional AI insights.

### API usage & caching

Prices are **cached for 24 hours** and shared across all users. The first request of the day triggers one bulk scan; every request after that uses the cache until it expires.

| Source | Key needed? | Cost | Usage with daily cache |
|--------|-------------|------|------------------------|
| **SteamApis** | Yes (free tier) | 500 requests/month free | **~1 request/day ≈ 30/month** |
| Skinport | No | Free (8 req/5min limit) | 1 request/day (automatic backup) |
| CSFloat schema | No | Free | Cached 24h |
| OpenRouter | Optional | Pay per use | Only when clicking "AI Insight" |

### SteamApis free tier

- **500 requests per billing cycle** (monthly, resets each cycle)
- **Free forever** — recurring, not one-time
- With daily caching you use **~30 requests/month** (one bulk fetch per day)
- Overage if you exceed 500: €0.0005 per extra request
- Paid tiers start at €9.99/mo for 100k requests if you need more

Without `STEAMAPIS_API_KEY`, only Skinport prices are used (less complete coverage for all wears).

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
