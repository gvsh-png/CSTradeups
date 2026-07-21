import {
  CSFLOAT_FEE,
  RARITY_ORDER,
  STEAM_FEE,
  type Complexity,
} from "../constants";
import { getPrice, mergePriceCandidates } from "../prices";
import { getSkinImage } from "../schema";
import {
  clampFloat,
  f32,
  getMaxInputFloat,
  getWear,
  marketHashName,
  norm,
  outF,
  r2,
  r4,
} from "./float";
import type {
  GenerateParams,
  PriceMap,
  SchemaData,
  SkinData,
  TradeUpInput,
  TradeUpOutcome,
  TradeUpResult,
} from "./types";

interface InputCandidate {
  skin: SkinData;
  price: number;
  wear: string;
  float: number;
}

interface OutcomeCalc {
  name: string;
  float: number;
  wear: string;
  price: number;
  prob: number;
  outMinF: number;
  outMaxF: number;
}

function partitions(
  total: number,
  parts: number,
  minPer: number
): number[][] {
  const result: number[][] = [];

  function recurse(
    remaining: number,
    k: number,
    maxVal: number,
    current: number[]
  ) {
    if (k === 1) {
      if (remaining >= minPer && remaining <= maxVal) {
        result.push([...current, remaining]);
      }
      return;
    }
    const lo = minPer;
    const hi = Math.min(maxVal, remaining - minPer * (k - 1));
    for (let v = lo; v <= hi; v++) {
      recurse(remaining - v, k - 1, v, [...current, v]);
    }
  }

  recurse(total, parts, total, []);
  return result.map((p) => [...p].reverse());
}

function calcWinLoss(
  outcomes: OutcomeCalc[],
  totalCost: number,
  fee: number
) {
  let winSum = 0;
  let winProb = 0;
  let lossSum = 0;
  let lossProb = 0;

  for (const o of outcomes) {
    const net = o.price * (1 - fee) - totalCost;
    if (net >= 0) {
      winSum += net * o.prob;
      winProb += o.prob;
    } else {
      lossSum += Math.abs(net) * o.prob;
      lossProb += o.prob;
    }
  }

  return {
    winPct: r2(winProb * 100),
    avgWin: r2(winProb > 0 ? winSum / winProb : 0),
    avgLoss: r2(lossProb > 0 ? lossSum / lossProb : 0),
  };
}

function applyComplexity(
  inputs: TradeUpInput[],
  complexity: Complexity,
  outcomes: OutcomeCalc[],
  fee: number,
  totalCost: number
): TradeUpInput[] {
  if (complexity === "simple") {
    return inputs.map((i) => ({ ...i, maxFloat: i.maxF }));
  }

  if (complexity === "moderate") {
    return inputs.map((i) => {
      const maxFloat = getMaxInputFloat(
        { minF: i.minF, maxF: i.maxF },
        outcomes.map((o) => ({ minF: o.outMinF, maxF: o.outMaxF })),
        totalCost,
        fee,
        (wear, outMin, outMax) => {
          const f = outF(norm(i.float, i.minF, i.maxF), outMin, outMax);
          return getPrice({} as PriceMap, i.name, getWear(f));
        }
      );
      return { ...i, maxFloat };
    });
  }

  return inputs.map((i) => ({
    ...i,
    maxFloat: r4(i.float + 0.005),
  }));
}

function buildOutcomes(
  slots: {
    count: number;
    outs: SkinData[];
    n: number;
  }[],
  prices: PriceMap,
  schema: SchemaData
): OutcomeCalc[] {
  const mixed: OutcomeCalc[] = [];

  for (const slot of slots) {
    for (const outSkin of slot.outs) {
      const avgN =
        slots.reduce((s, sl) => s + sl.n * sl.count, 0) / 10;
      const outFloat = outF(avgN, outSkin.minF, outSkin.maxF);
      const wear = getWear(outFloat);
      const price = getPrice(prices, outSkin.name, wear);

      mixed.push({
        name: outSkin.name,
        float: r4(outFloat),
        wear,
        price,
        prob: (slot.count / 10) * (1 / slot.outs.length),
        outMinF: outSkin.minF,
        outMaxF: outSkin.maxF,
      });
    }
  }

  return mixed;
}

function toTradeUpResult(
  inputs: TradeUpInput[],
  outcomes: OutcomeCalc[],
  params: GenerateParams,
  schema: SchemaData,
  inputRarity: string,
  outputRarity: string,
  type: "single" | "mixed",
  fee: number
): TradeUpResult | null {
  const totalCost = r2(inputs.reduce((s, i) => s + i.price * i.count, 0));
  const ev = outcomes.reduce(
    (s, o) => s + o.prob * o.price * (1 - fee),
    0
  );
  const profit = r2(ev - totalCost);
  const roi = totalCost > 0 ? r2((profit / totalCost) * 100) : 0;

  if (roi < params.targetRoi) return null;
  if (totalCost < params.minPrice || totalCost > params.maxPrice) return null;

  const { winPct, avgWin, avgLoss } = calcWinLoss(outcomes, totalCost, fee);

  const finalInputs = applyComplexity(
    inputs,
    params.complexity,
    outcomes,
    fee,
    totalCost
  );

  const tradeOutcomes: TradeUpOutcome[] = outcomes
    .map((o) => ({
      name: o.name,
      float: o.float,
      wear: o.wear,
      price: o.price,
      prob: r2(o.prob * 100),
      profit: r2(o.price * (1 - fee) - totalCost),
      image: getSkinImage(schema, o.name),
      outMinF: o.outMinF,
      outMaxF: o.outMaxF,
    }))
    .sort((a, b) => b.price - a.price);

  const desc = finalInputs
    .map((i) => `${i.count}x ${i.name} (${i.wear})`)
    .join(" + ");

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    inputs: finalInputs.map((i) => ({
      ...i,
      image: i.image || getSkinImage(schema, i.name),
    })),
    outcomes: tradeOutcomes,
    totalCost,
    expectedValue: r2(ev),
    expectedProfit: profit,
    roi,
    winPct,
    avgWin,
    avgLoss,
    inputRarity,
    outputRarity,
    complexity: params.complexity,
    description: desc,
    fee,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateTradeUps(
  skinDB: SkinData[],
  byCR: Record<string, SkinData[]>,
  prices: PriceMap,
  schema: SchemaData,
  params: GenerateParams
): Promise<TradeUpResult[]> {
  const fee = params.feeType === "csfloat" ? CSFLOAT_FEE : STEAM_FEE;
  const candidates: TradeUpResult[] = [];
  const seenKeys = new Set<string>();
  const limit = params.limit ?? 20;

  const cheapIn: Record<string, InputCandidate> = {};
  const testFloats = [0.27, 0.11, 0.035, 0.42, 0.7];

  for (const [key, list] of Object.entries(byCR)) {
    for (const skin of list) {
      for (const tf of testFloats) {
        const af = clampFloat(tf, skin.minF, skin.maxF);
        const wear = getWear(af);
        const price = getPrice(prices, skin.name, wear);
        if (price <= 0) continue;
        if (price > params.maxPrice / 5) continue;

        if (!cheapIn[key] || price < cheapIn[key].price) {
          cheapIn[key] = { skin, price, wear, float: af };
        }
      }
    }
  }

  for (let ri = 0; ri < RARITY_ORDER.length - 1; ri++) {
    const inR = RARITY_ORDER[ri];
    const nextR = RARITY_ORDER[ri + 1];

    const ci: Record<string, InputCandidate> = {};
    for (const [key, val] of Object.entries(cheapIn)) {
      const [, rarity] = key.split("|");
      if (rarity === inR) {
        ci[key.split("|")[0]] = val;
      }
    }

    for (const [pcid, pInp] of Object.entries(ci)) {
      const pOS = byCR[`${pcid}|${nextR}`] || [];
      if (!pOS.length) continue;

      const pN = norm(pInp.float, pInp.skin.minF, pInp.skin.maxF);

      const singleInputs: TradeUpInput[] = [
        {
          name: pInp.skin.name,
          count: 10,
          price: pInp.price,
          wear: pInp.wear,
          float: pInp.float,
          minF: pInp.skin.minF,
          maxF: pInp.skin.maxF,
          image: pInp.skin.image,
        },
      ];

      const singleOuts = buildOutcomes(
        [{ count: 10, outs: pOS, n: pN }],
        prices,
        schema
      );

      const dk = `s|${pcid}|${pInp.skin.name}`;
      if (!seenKeys.has(dk)) {
        seenKeys.add(dk);
        const result = toTradeUpResult(
          singleInputs,
          singleOuts,
          params,
          schema,
          inR,
          nextR,
          "single",
          fee
        );
        if (result) candidates.push(result);
      }

      const bestOutP = Math.max(...singleOuts.map((o) => o.price), 0);
      if (bestOutP < pInp.price * 1.2) continue;

      const fillers: {
        cid: string;
        inp: InputCandidate;
        outs: SkinData[];
        n: number;
      }[] = [];

      for (const [fid, f] of Object.entries(ci)) {
        if (fid === pcid) continue;
        const fOuts = byCR[`${fid}|${nextR}`] || [];
        if (!fOuts.length) continue;
        fillers.push({
          cid: fid,
          inp: f,
          outs: fOuts,
          n: norm(f.float, f.skin.minF, f.skin.maxF),
        });
      }

      fillers.sort((a, b) => a.inp.price - b.inp.price);

      for (const f1 of fillers.slice(0, 8)) {
        for (const sp of partitions(10, 2, 1)) {
          const inputs: TradeUpInput[] = [
            {
              name: pInp.skin.name,
              count: sp[0],
              price: pInp.price,
              wear: pInp.wear,
              float: pInp.float,
              minF: pInp.skin.minF,
              maxF: pInp.skin.maxF,
              image: pInp.skin.image,
            },
            {
              name: f1.inp.skin.name,
              count: sp[1],
              price: f1.inp.price,
              wear: f1.inp.wear,
              float: f1.inp.float,
              minF: f1.inp.skin.minF,
              maxF: f1.inp.skin.maxF,
              image: f1.inp.skin.image,
            },
          ];

          const outs = buildOutcomes(
            [
              { count: sp[0], outs: pOS, n: pN },
              { count: sp[1], outs: f1.outs, n: f1.n },
            ],
            prices,
            schema
          );

          const mixKey = inputs
            .map((i) => `${i.name}:${i.count}`)
            .sort()
            .join("|");
          if (seenKeys.has(mixKey)) continue;
          seenKeys.add(mixKey);

          const result = toTradeUpResult(
            inputs,
            outs,
            params,
            schema,
            inR,
            nextR,
            "mixed",
            fee
          );
          if (result) candidates.push(result);
        }
      }
    }
  }

  candidates.sort((a, b) => b.expectedProfit - a.expectedProfit);
  return candidates.slice(0, limit);
}

const WEARS = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;

/**
 * Cross-wear sanity check: reject prices that are extreme outliers
 * compared to other wears of the same skin.
 */
export function sanitizePrices(
  prices: PriceMap,
  skinDB: SkinData[]
): PriceMap {
  const sanitized = { ...prices };

  for (const skin of skinDB) {
    const wearPrices: number[] = [];
    for (const wear of WEARS) {
      const p = prices[marketHashName(skin.name, wear)];
      if (p && p > 0) wearPrices.push(p);
    }
    if (wearPrices.length < 2) continue;

    const sorted = [...wearPrices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    for (const wear of WEARS) {
      const key = marketHashName(skin.name, wear);
      const p = sanitized[key];
      if (!p || p <= 0) continue;

      if (p < median * 0.15 || p > median * 8) {
        const corrected = mergePriceCandidates(
          wearPrices.filter((w) => w >= median * 0.15 && w <= median * 8)
        );
        if (corrected > 0) sanitized[key] = corrected;
      }
    }
  }

  return sanitized;
}

export function collectNeededMarketHashNames(
  skinDB: SkinData[],
  byCR: Record<string, SkinData[]>,
  params: GenerateParams
): string[] {
  const names = new Set<string>();
  const inputRarities = new Set(["Mil-Spec Grade", "Restricted", "Classified"]);
  const wears = ["Battle-Scarred", "Field-Tested", "Minimal Wear", "Well-Worn"];

  const relevantSkins = skinDB.filter((s) => inputRarities.has(s.rarity));

  for (const skin of relevantSkins) {
    for (const wear of wears) {
      names.add(marketHashName(skin.name, wear));
    }
  }

  for (const [key, list] of Object.entries(byCR)) {
    const rarity = key.split("|")[1];
    const ri = RARITY_ORDER.indexOf(rarity as (typeof RARITY_ORDER)[number]);
    if (ri < 0) continue;
    const nextR = RARITY_ORDER[ri + 1];
    if (!nextR) continue;

    for (const skin of list) {
      if (!inputRarities.has(skin.rarity) && skin.rarity !== nextR) continue;
      for (const wear of wears) {
        names.add(marketHashName(skin.name, wear));
      }
    }
  }

  return Array.from(names).slice(0, 200);
}
