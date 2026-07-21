import type { TradeUpResult } from "./tradeup/types";

/** Compact share payload — keeps URLs shorter */
interface SharePayload {
  v: 1;
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
  /** Cached AI insight — travels with share links */
  ins?: string;
  inputs: {
    n: string;
    c: number;
    p: number;
    w: string;
    f: number;
    img?: string;
    maxF?: number;
  }[];
  outs: {
    n: string;
    f: number;
    w: string;
    p: number;
    pr: number;
    pl: number;
    img?: string;
  }[];
}

type ComplexityCompact = "s" | "m" | "p";

function toCompact(tradeUp: TradeUpResult): SharePayload {
  return {
    v: 1,
    id: tradeUp.id,
    t: tradeUp.type === "mixed" ? "m" : "s",
    inR: tradeUp.inputRarity,
    outR: tradeUp.outputRarity,
    c:
      tradeUp.complexity === "precise"
        ? "p"
        : tradeUp.complexity === "moderate"
          ? "m"
          : "s",
    fee: tradeUp.fee,
    desc: tradeUp.description,
    at: tradeUp.generatedAt,
    tc: tradeUp.totalCost,
    ev: tradeUp.expectedValue,
    ep: tradeUp.expectedProfit,
    roi: tradeUp.roi,
    win: tradeUp.winPct,
    ...(tradeUp.insight ? { ins: tradeUp.insight } : {}),
    inputs: tradeUp.inputs.map((i) => ({
      n: i.name,
      c: i.count,
      p: i.price,
      w: i.wear,
      f: i.float,
      img: i.image,
      maxF: i.maxFloat,
    })),
    outs: tradeUp.outcomes.map((o) => ({
      n: o.name,
      f: o.float,
      w: o.wear,
      p: o.price,
      pr: o.prob,
      pl: o.profit,
      img: o.image,
    })),
  };
}

function fromCompact(p: SharePayload): TradeUpResult {
  const complexity =
    p.c === "p" ? "precise" : p.c === "m" ? "moderate" : "simple";
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
      image: i.img,
    })),
    outcomes: p.outs.map((o) => ({
      name: o.n,
      float: o.f,
      wear: o.w,
      price: o.p,
      prob: o.pr,
      profit: o.pl,
      image: o.img,
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
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
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
    const data = JSON.parse(json) as SharePayload;
    if (!data?.inputs || !data?.outs || data.v !== 1) return null;
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
  return `${base}/share?d=${encoded}`;
}
