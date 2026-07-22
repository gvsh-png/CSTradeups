import {
  CSFLOAT_FEE,
  RARITY_ORDER,
  STEAM_FEE,
  type Complexity,
} from "../constants";
import { getPrice } from "../prices";
import { getSkinImage } from "../schema";
import {
  clampFloat,
  f32,
  floatForWear,
  getMaxInputFloat,
  getWearForSkin,
  INPUT_WEAR_MIN_SPAN,
  marketHashName,
  norm,
  outF,
  possibleWears,
  r2,
  r4,
} from "./float";
import { riskRankScore, winChanceBucket, winChanceBandFromTarget } from "./risk";
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
  totalCost: number,
  prices: PriceMap
): TradeUpInput[] {
  if (complexity === "simple") {
    return inputs.map((i) => ({ ...i, maxFloat: i.maxF }));
  }

  if (complexity === "moderate") {
    // Price each outcome at the wear its float would land on for a given
    // normalized input value — uses the new normalized trade-up formula.
    const outcomeByRange = new Map<string, OutcomeCalc[]>();
    for (const o of outcomes) {
      const key = `${o.outMinF}|${o.outMaxF}`;
      const list = outcomeByRange.get(key) || [];
      list.push(o);
      outcomeByRange.set(key, list);
    }

    return inputs.map((i) => {
      const maxFloat = getMaxInputFloat(
        { minF: i.minF, maxF: i.maxF },
        outcomes.map((o) => ({
          minF: o.outMinF,
          maxF: o.outMaxF,
          weight: o.prob,
        })),
        totalCost,
        fee,
        (wear, outMin, outMax) => {
          const candidates = outcomeByRange.get(`${outMin}|${outMax}`) || [];
          if (!candidates.length) return 0;
          const sum = candidates.reduce(
            (s, o) => s + (getPrice(prices, o.name, wear) || o.price),
            0
          );
          return sum / candidates.length;
        }
      );
      // Never report a cap below the wear the trade-up was priced at
      return { ...i, maxFloat: Math.max(maxFloat, r4(i.float)) };
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

  // New CS2 trade-up formula: average the per-input normalized floats
  // (float32), then map into each outcome skin's own float range.
  const avgN = f32(
    slots.reduce((s, sl) => s + f32(sl.n) * sl.count, 0) / 10
  );

  for (const slot of slots) {
    for (const outSkin of slot.outs) {
      // Always land inside this skin's float caps (min/max), never exterior wear myths
      const outFloat = clampFloat(
        outF(avgN, outSkin.minF, outSkin.maxF),
        outSkin.minF,
        outSkin.maxF
      );
      const wear = getWearForSkin(outFloat, outSkin.minF, outSkin.maxF);
      // Incomplete contract: inventing odds for missing outcomes inflates EV/win%
      if (!possibleWears(outSkin.minF, outSkin.maxF, 0.001).includes(wear)) {
        return [];
      }
      const price = getPrice(prices, outSkin.name, wear);
      if (price <= 0) {
        return [];
      }

      mixed.push({
        name: outSkin.name,
        float: r4(outFloat),
        wear,
        price,
        // New odds: collection weight = inputs from that collection / 10,
        // split evenly across that collection's outcomes.
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
  fee: number,
  prices: PriceMap
): TradeUpResult | null {
  if (!outcomes.length) return null;

  // Reject contracts that somehow used an unobtainable input wear
  for (const i of inputs) {
    const ok = possibleWears(i.minF, i.maxF, INPUT_WEAR_MIN_SPAN).includes(
      i.wear
    );
    if (!ok) return null;
  }

  const totalCost = r2(inputs.reduce((s, i) => s + i.price * i.count, 0));
  const ev = outcomes.reduce(
    (s, o) => s + o.prob * o.price * (1 - fee),
    0
  );
  const profit = r2(ev - totalCost);
  const roi = totalCost > 0 ? r2((profit / totalCost) * 100) : 0;

  if (totalCost < params.minPrice || totalCost > params.maxPrice) return null;

  const { winPct, avgWin, avgLoss } = calcWinLoss(outcomes, totalCost, fee);
  if (winPct < params.minWinChance || winPct > params.maxWinChance) return null;

  const finalInputs = applyComplexity(
    inputs,
    params.complexity,
    outcomes,
    fee,
    totalCost,
    prices
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

function weaponOf(skinName: string): string {
  return skinName.split(" | ")[0] || skinName;
}

/** Best priced wear/float option for a skin under the budget cap */
function bestCandidateForSkin(
  skin: SkinData,
  prices: PriceMap,
  maxUnitPrice: number
): InputCandidate | null {
  let best: InputCandidate | null = null;
  // Strict span — no "Well-Worn" on a skin that only reaches 0.39
  for (const wear of possibleWears(skin.minF, skin.maxF, INPUT_WEAR_MIN_SPAN)) {
    const af = floatForWear(skin.minF, skin.maxF, wear);
    if (af == null) continue;
    const price = getPrice(prices, skin.name, wear);
    if (price <= 0 || price > maxUnitPrice) continue;
    if (!best || price < best.price) {
      best = { skin, price, wear, float: af };
    }
  }
  return best;
}

/**
 * Pick up to `limit` trade-ups with skin diversity AND win-chance variety.
 * Caps how many results share the same ~10% win bucket so the list isn't
 * fifteen copies of "40% win".
 */
function selectDiverseResults(
  candidates: TradeUpResult[],
  limit: number,
  targetWinChance: number
): TradeUpResult[] {
  const sorted = [...candidates].sort((a, b) => {
    const sb = riskRankScore(b.winPct, b.expectedProfit, targetWinChance);
    const sa = riskRankScore(a.winPct, a.expectedProfit, targetWinChance);
    return sb - sa;
  });
  const selected: TradeUpResult[] = [];
  const usedIds = new Set<string>();
  const usedSkins = new Set<string>();
  const usedWeapons = new Set<string>();
  const winBucketCounts = new Map<number, number>();
  // Spread across buckets: ~2 per 10pt bin for a 15-result list
  const maxPerWinBucket = Math.max(2, Math.ceil(limit / 6));

  const inputSkins = (t: TradeUpResult) => t.inputs.map((i) => i.name);
  const inputWeapons = (t: TradeUpResult) =>
    t.inputs.map((i) => weaponOf(i.name));

  const take = (t: TradeUpResult) => {
    selected.push(t);
    usedIds.add(t.id);
    for (const s of inputSkins(t)) usedSkins.add(s);
    for (const w of inputWeapons(t)) usedWeapons.add(w);
    const b = winChanceBucket(t.winPct);
    winBucketCounts.set(b, (winBucketCounts.get(b) || 0) + 1);
  };

  const bucketOk = (t: TradeUpResult) =>
    (winBucketCounts.get(winChanceBucket(t.winPct)) || 0) < maxPerWinBucket;

  // Pass 1: unique skins+weapons, and spread win %
  for (const c of sorted) {
    if (selected.length >= limit) break;
    if (!bucketOk(c)) continue;
    const skins = inputSkins(c);
    const weapons = inputWeapons(c);
    if (skins.some((s) => usedSkins.has(s))) continue;
    if (weapons.some((w) => usedWeapons.has(w))) continue;
    take(c);
  }

  // Pass 2: unique skins, weapons may repeat — still spread win %
  if (selected.length < limit) {
    for (const c of sorted) {
      if (selected.length >= limit) break;
      if (usedIds.has(c.id)) continue;
      if (!bucketOk(c)) continue;
      const skins = inputSkins(c);
      if (skins.some((s) => usedSkins.has(s))) continue;
      take(c);
    }
  }

  // Pass 3: relax win-bucket cap, keep some skin novelty
  if (selected.length < limit) {
    for (const c of sorted) {
      if (selected.length >= limit) break;
      if (usedIds.has(c.id)) continue;
      const skins = inputSkins(c);
      if (skins.length > 0 && skins.every((s) => usedSkins.has(s))) continue;
      take(c);
    }
  }

  // Pass 4: fill any remaining slots
  if (selected.length < limit) {
    for (const c of sorted) {
      if (selected.length >= limit) break;
      if (usedIds.has(c.id)) continue;
      take(c);
    }
  }

  return selected;
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
  /** Distinct input skins kept per collection×rarity */
  const SKINS_PER_POOL = 4;
  /** How many filler partners to try per primary */
  const FILLER_CAP = 10;

  const cheapIn: Record<string, InputCandidate[]> = {};
  const maxUnit = params.maxPrice / 5;

  for (const [key, list] of Object.entries(byCR)) {
    const options: InputCandidate[] = [];
    for (const skin of list) {
      const best = bestCandidateForSkin(skin, prices, maxUnit);
      if (best) options.push(best);
    }
    options.sort((a, b) => a.price - b.price);
    // Prefer distinct weapons first, then fill remaining slots by price
    const picked: InputCandidate[] = [];
    const seenWeapons = new Set<string>();
    for (const opt of options) {
      if (picked.length >= SKINS_PER_POOL) break;
      const w = weaponOf(opt.skin.name);
      if (seenWeapons.has(w)) continue;
      seenWeapons.add(w);
      picked.push(opt);
    }
    for (const opt of options) {
      if (picked.length >= SKINS_PER_POOL) break;
      if (picked.some((p) => p.skin.name === opt.skin.name)) continue;
      picked.push(opt);
    }
    if (picked.length) cheapIn[key] = picked;
  }

  for (let ri = 0; ri < RARITY_ORDER.length - 1; ri++) {
    const inR = RARITY_ORDER[ri];
    const nextR = RARITY_ORDER[ri + 1];

    const ci: Record<string, InputCandidate[]> = {};
    for (const [key, vals] of Object.entries(cheapIn)) {
      const [cid, rarity] = key.split("|");
      if (rarity === inR) ci[cid] = vals;
    }

    for (const [pcid, primaries] of Object.entries(ci)) {
      const pOS = byCR[`${pcid}|${nextR}`] || [];
      if (!pOS.length) continue;

      for (const pInp of primaries) {
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
            fee,
            prices
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

        for (const [fid, flist] of Object.entries(ci)) {
          if (fid === pcid) continue;
          const fOuts = byCR[`${fid}|${nextR}`] || [];
          if (!fOuts.length) continue;
          for (const f of flist) {
            // Skip same skin or same weapon as primary for clearer variety
            if (f.skin.name === pInp.skin.name) continue;
            if (weaponOf(f.skin.name) === weaponOf(pInp.skin.name)) continue;
            fillers.push({
              cid: fid,
              inp: f,
              outs: fOuts,
              n: norm(f.float, f.skin.minF, f.skin.maxF),
            });
          }
        }

        fillers.sort((a, b) => a.inp.price - b.inp.price);

        // Prefer filler skins we haven't paired with this primary yet
        const seenFillerSkins = new Set<string>();
        const diverseFillers: typeof fillers = [];
        for (const f of fillers) {
          if (seenFillerSkins.has(f.inp.skin.name)) continue;
          seenFillerSkins.add(f.inp.skin.name);
          diverseFillers.push(f);
          if (diverseFillers.length >= FILLER_CAP) break;
        }

        for (const f1 of diverseFillers) {
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
              fee,
              prices
            );
            if (result) candidates.push(result);
          }
        }
      }
    }
  }

  const { target } = winChanceBandFromTarget(params.targetWinChance);
  return selectDiverseResults(candidates, limit, target);
}

/**
 * Light cleanup only. Aggressive cross-wear clamps caused worse bugs
 * (First Class BS crushed; MW premiums destroyed). Source merge in
 * lib/prices.ts handles SteamApis vs Skinport disagreements.
 */
export function sanitizePrices(
  prices: PriceMap,
  _skinDB: SkinData[]
): PriceMap {
  return { ...prices };
}

/**
 * Re-apply live bulk prices to a trade-up and recompute EV / ROI / win%.
 * Shared by /api/refresh and post-generate so both paths match.
 */
export function repriceTradeUp(
  tradeUp: TradeUpResult,
  prices: PriceMap
): TradeUpResult {
  const fee = tradeUp.fee;

  const inputs = tradeUp.inputs.map((input) => {
    // Never keep a stale optimistic quote after liquidity drops to zero
    const price = getPrice(prices, input.name, input.wear);
    return { ...input, price };
  });

  const totalCost = r2(
    inputs.reduce((s, i) => s + i.price * i.count, 0)
  );

  const outcomes = tradeUp.outcomes
    .map((o) => {
      const price = getPrice(prices, o.name, o.wear);
      const profit = r2(price * (1 - fee) - totalCost);
      return { ...o, price, profit };
    })
    .sort((a, b) => b.price - a.price);

  const ev = outcomes.reduce((s, o) => {
    const prob = o.prob / 100;
    return s + prob * o.price * (1 - fee);
  }, 0);

  const expectedProfit = r2(ev - totalCost);
  const roi = totalCost > 0 ? r2((expectedProfit / totalCost) * 100) : 0;

  let winPct = 0;
  for (const o of outcomes) {
    if (o.profit >= 0) winPct += o.prob;
  }
  winPct = r2(winPct);

  return {
    ...tradeUp,
    inputs,
    outcomes,
    totalCost,
    expectedValue: r2(ev),
    expectedProfit,
    roi,
    winPct,
  };
}

export function collectNeededMarketHashNames(
  skinDB: SkinData[],
  byCR: Record<string, SkinData[]>,
  params: GenerateParams
): string[] {
  const names = new Set<string>();
  const inputRarities = new Set(["Mil-Spec Grade", "Restricted", "Classified"]);

  const relevantSkins = skinDB.filter((s) => inputRarities.has(s.rarity));

  for (const skin of relevantSkins) {
    for (const wear of possibleWears(skin.minF, skin.maxF)) {
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
      for (const wear of possibleWears(skin.minF, skin.maxF)) {
        names.add(marketHashName(skin.name, wear));
      }
    }
  }

  return Array.from(names).slice(0, 200);
}
