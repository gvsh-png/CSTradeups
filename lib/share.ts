import type { TradeUpResult } from "./tradeup/types";

/**
 * Compact share payload — intentionally omits image URLs.
 * Full Steam CDN URLs blow past messenger/browser URL limits and corrupt links.
 */
interface SharePayload {
  v: 2;
  id: string;
  t: "s" | "m";
  inR: string;
  outR: string;
  c: ComplexityCompact;
  fee: number;
  desc: string;
  at: string;
  tc: number;
  ev: number;
  ep: number;
  roi: number;
  win: number;
  /** Cached AI insight — travels with share links (capped) */
  ins?: string;
  inputs: {
    n: string;
    c: number;
    p: number;
    w: string;
    f: number;
    maxF?: number;
  }[];
  outs: {
    n: string;
    f: number;
    w: string;
    p: number;
    pr: number;
    pl: number;
  }[];
}

/** Legacy v1 payload may still include img fields */
interface SharePayloadV1 extends Omit<SharePayload, "v"> {
  v: 1;
  inputs: (SharePayload["inputs"][number] & { img?: string })[];
  outs: (SharePayload["outs"][number] & { img?: string })[];
}

type ComplexityCompact = "s" | "c" | "v" | "m" | "p";

const MAX_INSIGHT_CHARS = 500;

function toCompact(tradeUp: TradeUpResult): SharePayload {
  const insight =
    tradeUp.insight && tradeUp.insight.length > MAX_INSIGHT_CHARS
      ? `${tradeUp.insight.slice(0, MAX_INSIGHT_CHARS - 1)}…`
      : tradeUp.insight;

  return {
    v: 2,
    id: tradeUp.id,
    t: tradeUp.type === "mixed" ? "m" : "s",
    inR: tradeUp.inputRarity,
    outR: tradeUp.outputRarity,
    c:
      tradeUp.complexity === "covert"
        ? "c"
        : tradeUp.complexity === "souvenir"
          ? "v"
          : "s",
    fee: tradeUp.fee,
    desc: tradeUp.description,
    at: tradeUp.generatedAt,
    tc: tradeUp.totalCost,
    ev: tradeUp.expectedValue,
    ep: tradeUp.expectedProfit,
    roi: tradeUp.roi,
    win: tradeUp.winPct,
    ...(insight ? { ins: insight } : {}),
    inputs: tradeUp.inputs.map((i) => ({
      n: i.name,
      c: i.count,
      p: i.price,
      w: i.wear,
      f: i.float,
      maxF: i.maxFloat,
    })),
    outs: tradeUp.outcomes.map((o) => ({
      n: o.name,
      f: o.float,
      w: o.wear,
      p: o.price,
      pr: o.prob,
      pl: o.profit,
    })),
  };
}

function fromCompact(p: SharePayload | SharePayloadV1): TradeUpResult {
  const complexity =
    p.c === "c"
      ? "covert"
      : p.c === "v"
        ? "souvenir"
        : "standard";
  return {
    id: p.id,
    type: p.t === "m" ? "mixed" : "single",
    inputRarity: p.inR,
    outputRarity: p.outR,
    complexity,
    fee: p.fee,
    description: p.desc,
    generatedAt: p.at,
    totalCost: p.tc,
    expectedValue: p.ev,
    expectedProfit: p.ep,
    roi: p.roi,
    winPct: p.win,
    avgWin: 0,
    avgLoss: 0,
    insight: p.ins,
    inputs: p.inputs.map((i) => ({
      name: i.n,
      count: i.c,
      price: i.p,
      wear: i.w,
      float: i.f,
      minF: 0,
      maxF: 1,
      maxFloat: i.maxF,
      image: "img" in i ? i.img : undefined,
    })),
    outcomes: p.outs.map((o) => ({
      name: o.n,
      float: o.f,
      wear: o.w,
      price: o.p,
      prob: o.pr,
      profit: o.pl,
      image: "img" in o ? o.img : undefined,
      outMinF: 0,
      outMaxF: 1,
    })),
  };
}

function toBase64Url(json: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const cleaned = encoded.trim().replace(/\s+/g, "");
  const padded = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeTradeUpShare(tradeUp: TradeUpResult): string {
  return toBase64Url(JSON.stringify(toCompact(tradeUp)));
}

export function decodeTradeUpShare(encoded: string): TradeUpResult | null {
  try {
    const json = fromBase64Url(encoded);
    const data = JSON.parse(json) as SharePayload | SharePayloadV1;
    if (!data?.inputs || !data?.outs) return null;
    if (data.v !== 1 && data.v !== 2) return null;
    return fromCompact(data);
  } catch {
    return null;
  }
}

export function buildShareUrl(tradeUp: TradeUpResult, origin?: string): string {
  const encoded = encodeTradeUpShare(tradeUp);
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  // encodeURIComponent keeps the link intact across messengers / copy-paste
  return `${base}/share?d=${encodeURIComponent(encoded)}`;
}

/** Fill missing skin images via schema lookup */
export async function hydrateTradeUpImages(
  tradeUp: TradeUpResult
): Promise<TradeUpResult> {
  const needLookup = [
    ...tradeUp.inputs.filter((i) => !i.image).map((i) => i.name),
    ...tradeUp.outcomes.filter((o) => !o.image).map((o) => o.name),
  ];
  if (!needLookup.length) return tradeUp;

  try {
    const res = await fetch("/api/skin-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: [...new Set(needLookup)] }),
    });
    if (!res.ok) return tradeUp;
    const data = (await res.json()) as { images?: Record<string, string> };
    const images = data.images || {};
    return {
      ...tradeUp,
      inputs: tradeUp.inputs.map((i) => ({
        ...i,
        image: i.image || images[i.name],
      })),
      outcomes: tradeUp.outcomes.map((o) => ({
        ...o,
        image: o.image || images[o.name],
      })),
    };
  } catch {
    return tradeUp;
  }
}
