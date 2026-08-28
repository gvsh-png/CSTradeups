/**
 * Guards for /api/insight — prevent OpenRouter credit drain via
 * unauthenticated oversized / high-volume requests.
 */

/** Raw POST body ceiling (bytes / chars) before JSON parse */
export const MAX_INSIGHT_BODY_CHARS = 48_000;

/** Compact trade-up JSON ceiling sent to the model */
export const MAX_INSIGHT_PROMPT_CHARS = 12_000;

export const INSIGHT_RATE_LIMIT = 30;
export const INSIGHT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type RateBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, RateBucket>();

function pruneMemoryBuckets(now: number) {
  if (memoryBuckets.size < 500) return;
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }
}

/** Best-effort client key (IP) for rate limiting */
export function insightClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

/**
 * Sliding fixed-window rate limit (per-instance memory).
 * Returns false when the client is over the limit.
 */
export function allowInsightRequest(
  clientKey: string,
  now = Date.now()
): boolean {
  pruneMemoryBuckets(now);
  const key = clientKey || "unknown";
  const hit = memoryBuckets.get(key);
  if (!hit || hit.resetAt <= now) {
    memoryBuckets.set(key, {
      count: 1,
      resetAt: now + INSIGHT_RATE_WINDOW_MS,
    });
    return true;
  }
  if (hit.count >= INSIGHT_RATE_LIMIT) return false;
  hit.count += 1;
  return true;
}

/** Test helper — clear in-memory buckets */
export function resetInsightRateLimitForTests() {
  memoryBuckets.clear();
}

function compactSkin(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.slice(0, 160) : "";
  if (!name) return null;
  const out: Record<string, unknown> = { name };
  if (typeof r.wear === "string") out.wear = r.wear.slice(0, 32);
  if (typeof r.count === "number" && Number.isFinite(r.count)) {
    out.count = Math.min(10, Math.max(0, Math.floor(r.count)));
  }
  if (typeof r.price === "number" && Number.isFinite(r.price)) {
    out.price = r.price;
  }
  if (typeof r.prob === "number" && Number.isFinite(r.prob)) {
    out.prob = r.prob;
  }
  if (typeof r.profit === "number" && Number.isFinite(r.profit)) {
    out.profit = r.profit;
  }
  return out;
}

/**
 * Validate + compact a trade-up for the OpenRouter prompt.
 * Drops unknown fields so junk payloads cannot inflate token cost.
 */
export function compactInsightTradeUp(
  tradeUp: unknown
): { ok: true; payload: string } | { ok: false; error: string } {
  if (!tradeUp || typeof tradeUp !== "object" || Array.isArray(tradeUp)) {
    return { ok: false, error: "Invalid trade-up" };
  }
  const t = tradeUp as Record<string, unknown>;
  if (!Array.isArray(t.inputs) || !Array.isArray(t.outcomes)) {
    return { ok: false, error: "Invalid trade-up" };
  }
  if (t.inputs.length < 1 || t.inputs.length > 10) {
    return { ok: false, error: "Invalid trade-up inputs" };
  }
  if (t.outcomes.length < 1 || t.outcomes.length > 64) {
    return { ok: false, error: "Invalid trade-up outcomes" };
  }

  const inputs = t.inputs
    .map(compactSkin)
    .filter((x): x is Record<string, unknown> => Boolean(x));
  const outcomes = t.outcomes
    .map(compactSkin)
    .filter((x): x is Record<string, unknown> => Boolean(x));
  if (!inputs.length || !outcomes.length) {
    return { ok: false, error: "Invalid trade-up" };
  }

  const compact: Record<string, unknown> = {
    inputs,
    outcomes,
  };
  if (typeof t.description === "string") {
    compact.description = t.description.slice(0, 240);
  }
  if (typeof t.inputRarity === "string") {
    compact.inputRarity = t.inputRarity.slice(0, 40);
  }
  if (typeof t.outputRarity === "string") {
    compact.outputRarity = t.outputRarity.slice(0, 40);
  }
  for (const key of [
    "totalCost",
    "expectedValue",
    "expectedProfit",
    "roi",
    "winPct",
    "fee",
  ] as const) {
    const v = t[key];
    if (typeof v === "number" && Number.isFinite(v)) compact[key] = v;
  }

  const payload = JSON.stringify(compact);
  if (payload.length > MAX_INSIGHT_PROMPT_CHARS) {
    return { ok: false, error: "Trade-up too large" };
  }
  return { ok: true, payload };
}
