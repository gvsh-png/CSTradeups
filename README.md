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

> **Later (not enabled yet):** Steam-only login, free weekly scan limits, 1 saved trade-up on free, and Stripe Pro for unlimited — see [Steam login + subscriptions (enable later)](#steam-login--subscriptions-enable-later).

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

Auth/billing env vars are listed in the section below — leave them empty until you are ready to turn limits on.

### Do I need other APIs?

**No — SteamApis alone is enough for pricing.** The app automatically uses Skinport as a free backup (no key required) when merging prices. OpenRouter is only for optional AI insights.

## Steam login + subscriptions (enable later)

**Status: deferred.** Supporting code is in the repo but stays **off** until you add the env vars. Keep shipping product features first; when you are ready, follow this checklist.

### Planned product rules

Defaults live in `lib/billing/plans.ts` (easy to change):

| Plan | Scans | Saved trade-ups | Login |
|------|-------|-----------------|-------|
| **Free** | 5 / week | 1 at a time | Steam only |
| **Pro** | Unlimited | Unlimited | Steam + Stripe |

No Google/Discord/etc. — Steam accounts only.

### When you are ready — enable Steam login

1. Create a [Steam Web API key](https://steamcommunity.com/dev/apikey) (domain = your site).
2. Create a free [Upstash Redis](https://upstash.com) database → copy REST URL + token.
3. Generate a session secret: `openssl rand -base64 32`
4. In Vercel (or `.env.local`), set:

| Variable | Description |
|----------|-------------|
| `STEAM_API_KEY` | Steam Web API key |
| `AUTH_SECRET` | Session signing secret |
| `APP_URL` | Public URL, e.g. `https://your-domain.com` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `AUTH_REQUIRED` | Optional; `true` forces login (default: on once auth is fully configured) |

5. Redeploy → confirm **Sign in** appears in the header.

### When you are ready — enable Pro billing

1. Create a Product + recurring Price in [Stripe](https://dashboard.stripe.com).
2. Set `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID`.
3. Add webhook endpoint: `https://your-domain.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Set `STRIPE_WEBHOOK_SECRET` from the webhook details.

Until those vars are set, the site stays open (no login wall, no caps).

### Related code (already in repo)

- Auth: `lib/auth/*`, `app/api/auth/*`
- Quotas: `lib/billing/plans.ts`, `lib/usage/store.ts`, `app/api/usage/save`
- Stripe: `lib/billing/stripe.ts`, `app/api/billing/*`
- UI: `components/AuthMenu.tsx`, `components/UpgradeModal.tsx`, `components/AuthProvider.tsx`

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
- (Later) Steam OpenID + Upstash Redis quotas + Stripe Pro
