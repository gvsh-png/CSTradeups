import {
  CSFLOAT_FEE,
  RARITY_ORDER,
  STEAM_FEE,
  inputCountForMode,
  type Complexity,
} from "../constants";
import { getPrice } from "../prices";
import { getSkinImage } from "../schema";
import {
  clampFloat,
  f32,
  floatForWear,
  fractionsToPercents,
  getWearForSkin,
  INPUT_WEAR_MIN_SPAN,
  marketHashName,
  norm,
  outF,
  possibleWears,
  clampWinPct,
  r2,
  r4,
} from "./float";
import { riskRankScore, winChanceBucket, winChanceBandFromTarget } from "./risk";
import { prevRarity, targetHitPct } from "./targets";
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
    winPct:
      winProb >= 1 - 1e-12 ? 100 : clampWinPct(winProb * 100),
    avgWin: r2(winProb > 0 ? winSum / winProb : 0),
    avgLoss: r2(lossProb > 0 ? lossSum / lossProb : 0),
  };
}

/** EV / profit / ROI from the same display percents shown on outcome rows */
function metricsFromDisplayOutcomes(
  outcomes: { prob: number; price: number }[],
  totalCost: number,
  fee: number
): { expectedValue: number; expectedProfit: number; roi: number } {
  const ev = outcomes.reduce(
    (s, o) => s + (o.prob / 100) * o.price * (1 - fee),
    0
  );
  const expectedProfit = r2(ev - totalCost);
  const roi =
    totalCost > 0 ? r2((expectedProfit / totalCost) * 100) : 0;
  return { expectedValue: r2(ev), expectedProfit, roi };
}

function applyComplexity(
  inputs: TradeUpInput[],
  _complexity: Complexity,
  _outcomes: OutcomeCalc[],
  _fee: number,
  _totalCost: number,
  _prices: PriceMap
): TradeUpInput[] {
  // Modes no longer change float targeting — wear tier only
  return inputs.map((i) => ({ ...i, maxFloat: i.maxF }));
}

function buildOutcomes(
  slots: {
    count: number;
    outs: SkinData[];
    n: number;
  }[],
  prices: PriceMap,
  _schema: SchemaData,
  inputTotal: number
): OutcomeCalc[] {
  const mixed: OutcomeCalc[] = [];
  if (inputTotal <= 0) return [];

  const avgN = f32(
    slots.reduce((s, sl) => s + f32(sl.n) * sl.count, 0) / inputTotal
  );

  for (const slot of slots) {
    const totalWeight = slot.outs.reduce(
      (s, o) => s + Math.max(1, o.outcomeWeight || 1),
      0
    );
    if (totalWeight <= 0) return [];

    for (const outSkin of slot.outs) {
      const weight = Math.max(1, outSkin.outcomeWeight || 1);
      const outFloat = clampFloat(
        outF(avgN, outSkin.minF, outSkin.maxF),
        outSkin.minF,
        outSkin.maxF
      );
      const wear = getWearForSkin(outFloat, outSkin.minF, outSkin.maxF);
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
        prob: (slot.count / inputTotal) * (weight / totalWeight),
        outMinF: outSkin.minF,
        outMaxF: outSkin.maxF,
      });
    }
  }

  // Merge identical market rows (e.g. collapsed Doppler phases already weighted)
  const merged = new Map<string, OutcomeCalc>();
  for (const o of mixed) {
    const key = `${o.name}|${o.wear}|${o.float}`;
    const prev = merged.get(key);
    if (prev) {
      prev.prob += o.prob;
    } else {
      merged.set(key, { ...o });
    }
  }

  return [...merged.values()];
}

/** Keep only specials that have a buyable price for the float-derived wear */
function pricedSpecialOutcomes(
  outs: SkinData[],
  avgN: number,
  prices: PriceMap
): SkinData[] {
  return outs.filter((outSkin) => {
    const outFloat = clampFloat(
      outF(avgN, outSkin.minF, outSkin.maxF),
      outSkin.minF,
      outSkin.maxF
    );
    const wear = getWearForSkin(outFloat, outSkin.minF, outSkin.maxF);
    if (!possibleWears(outSkin.minF, outSkin.maxF, 0.001).includes(wear)) {
      return false;
    }
    return getPrice(prices, outSkin.name, wear) > 0;
  });
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
  prices: PriceMap,
  /** Soften price/win-band filters for Standard target-skin hunts */
  huntTarget = false
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

  // Target hunt: mid-tier skins (e.g. Rat Rod ~$4) need contract costs below
  // the user's min budget floor — don't reject those. Still respect maxPrice.
  const minCost = huntTarget ? 0 : params.minPrice;
  if (totalCost < minCost || totalCost > params.maxPrice) return null;

  const { winPct, avgWin, avgLoss } = calcWinLoss(outcomes, totalCost, fee);
  // Target hunt: keep any win% — ranking prefers profitable; hard band often
  // wiped every contract that can land the skin (0% win mono-collections).
  if (
    !huntTarget &&
    (winPct < params.minWinChance || winPct > params.maxWinChance)
  ) {
    return null;
  }

  const finalInputs = applyComplexity(
    inputs,
    params.complexity,
    outcomes,
    fee,
    totalCost,
    prices
  );

  const displayPercents = fractionsToPercents(outcomes.map((o) => o.prob));

  const tradeOutcomes: TradeUpOutcome[] = outcomes
    .map((o, i) => ({
      name: o.name,
      float: o.float,
      wear: o.wear,
      price: o.price,
      prob: displayPercents[i] ?? 0,
      profit: r2(o.price * (1 - fee) - totalCost),
      image: getSkinImage(schema, o.name),
      outMinF: o.outMinF,
      outMaxF: o.outMaxF,
    }))
    .sort((a, b) => b.price - a.price);

  // Win % from display probs so the header matches the outcome list
  let displayWin = 0;
  for (const o of tradeOutcomes) {
    if (o.profit >= 0) displayWin += o.prob;
  }
  const displayWinPct =
    tradeOutcomes.length > 0 && tradeOutcomes.every((o) => o.profit >= 0)
      ? 100
      : clampWinPct(displayWin);

  const { expectedValue, expectedProfit, roi } = metricsFromDisplayOutcomes(
    tradeOutcomes,
    totalCost,
    fee
  );

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
    expectedValue,
    expectedProfit,
    roi,
    winPct: displayWinPct,
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
  let name = skinName;
  if (name.startsWith("Souvenir ")) name = name.slice("Souvenir ".length);
  if (name.startsWith("★ ")) name = name.slice(2);
  return name.split(" | ")[0] || name;
}

/** Best priced wear/float option for a skin under the budget cap */
function bestCandidateForSkin(
  skin: SkinData,
  prices: PriceMap,
  maxUnitPrice: number
): InputCandidate | null {
  let best: InputCandidate | null = null;
  const isSouvenir = Boolean(
    skin.isSouvenir || skin.name.startsWith("Souvenir ")
  );
  const normalName = isSouvenir
    ? skin.name.slice("Souvenir ".length)
    : null;

  // Strict span — no "Well-Worn" on a skin that only reaches 0.39
  for (const wear of possibleWears(skin.minF, skin.maxF, INPUT_WEAR_MIN_SPAN)) {
    const af = floatForWear(skin.minF, skin.maxF, wear);
    if (af == null) continue;
    const price = getPrice(prices, skin.name, wear);
    if (price <= 0 || price > maxUnitPrice) continue;

    // Souvenirs are almost always ≥ their normal counterpart. A souvenir
    // quote far below the normal book is a merge/stub ghost — skip it.
    if (normalName) {
      const normalPrice = getPrice(prices, normalName, wear);
      if (normalPrice > 0 && price < normalPrice * 0.85) continue;
    }

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
 *
 * When `targetOutcomeName` is set: prefer profitable contracts that can
 * land the skin, then higher hit chance — not max hit % with 0% win.
 */
function selectDiverseResults(
  candidates: TradeUpResult[],
  limit: number,
  targetWinChance: number,
  targetOutcomeName?: string
): TradeUpResult[] {
  const target = targetOutcomeName?.trim() || "";

  const sorted = [...candidates].sort((a, b) => {
    if (target) {
      // Profitable / any-win first — max hit% with every outcome losing is useless
      const aWin = a.winPct > 0 ? 1 : 0;
      const bWin = b.winPct > 0 ? 1 : 0;
      if (bWin !== aWin) return bWin - aWin;
      const aPos = a.expectedProfit > 0 ? 1 : 0;
      const bPos = b.expectedProfit > 0 ? 1 : 0;
      if (bPos !== aPos) return bPos - aPos;
      const tb = targetHitPct(b.outcomes, target);
      const ta = targetHitPct(a.outcomes, target);
      if (tb !== ta) return tb - ta;
      if (b.expectedProfit !== a.expectedProfit) {
        return b.expectedProfit - a.expectedProfit;
      }
    }
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
  // When hunting a specific skin, allow more per bucket so top hit-chances aren't dropped
  const maxPerWinBucket = target
    ? Math.max(6, Math.ceil(limit / 2))
    : Math.max(2, Math.ceil(limit / 6));

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
  params: GenerateParams,
  specialByCR: Record<string, SkinData[]> = {}
): Promise<TradeUpResult[]> {
  const fee = params.feeType === "csfloat" ? CSFLOAT_FEE : STEAM_FEE;
  const inputTotal = inputCountForMode(params.complexity);
  const limit = params.limit ?? 20;

  if (params.complexity === "covert") {
    return generateCovertTradeUps(
      byCR,
      specialByCR,
      prices,
      schema,
      params,
      fee,
      inputTotal,
      limit
    );
  }

  const candidates = generateTierTradeUps(
    byCR,
    prices,
    schema,
    params,
    fee,
    inputTotal
  );

  // Souvenir mode: keep contracts that use at least one souvenir input
  let filtered =
    params.complexity === "souvenir"
      ? candidates.filter((t) =>
          t.inputs.some((i) => i.name.startsWith("Souvenir "))
        )
      : candidates;

  const targetName =
    params.complexity === "standard" && params.targetOutcomeName?.trim()
      ? params.targetOutcomeName.trim()
      : "";

  // Standard + target: only contracts that can actually land the skin
  if (targetName) {
    filtered = filtered.filter(
      (t) => targetHitPct(t.outcomes, targetName) > 0
    );
  }

  const { target } = winChanceBandFromTarget(params.targetWinChance);
  return selectDiverseResults(
    filtered,
    limit,
    target,
    targetName || undefined
  );
}

function generateCovertTradeUps(
  byCR: Record<string, SkinData[]>,
  specialByCR: Record<string, SkinData[]>,
  prices: PriceMap,
  schema: SchemaData,
  params: GenerateParams,
  fee: number,
  inputTotal: number,
  limit: number
): TradeUpResult[] {
  const candidates: TradeUpResult[] = [];
  const seenKeys = new Set<string>();
  const SKINS_PER_POOL = 4;
  const FILLER_CAP = 8;
  const CANDIDATE_CAP = 1800;
  const maxUnit = params.maxPrice / Math.max(2, inputTotal - 1);
  const inR = "Covert";
  const nextR = "Extraordinary";

  const cheapIn: Record<string, InputCandidate[]> = {};
  for (const [key, list] of Object.entries(byCR)) {
    const [, rarity] = key.split("|");
    if (rarity !== inR) continue;
    const [cid] = key.split("|");
    // Only collections that actually drop knives/gloves
    if (!(specialByCR[`${cid}|Extraordinary`] || []).length) continue;

    const options: InputCandidate[] = [];
    for (const skin of list) {
      if (skin.isSpecial) continue;
      const best = bestCandidateForSkin(skin, prices, maxUnit);
      if (best) options.push(best);
    }
    options.sort((a, b) => a.price - b.price);
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
    if (picked.length) cheapIn[cid] = picked;
  }

  for (const [pcid, primaries] of Object.entries(cheapIn)) {
    const rawPOS = specialByCR[`${pcid}|Extraordinary`] || [];
    if (!rawPOS.length) continue;

    for (const pInp of primaries) {
      const pN = norm(pInp.float, pInp.skin.minF, pInp.skin.maxF);
      const pOS = pricedSpecialOutcomes(rawPOS, pN, prices);
      if (!pOS.length) continue;

      const singleInputs: TradeUpInput[] = [
        {
          name: pInp.skin.name,
          count: inputTotal,
          price: pInp.price,
          wear: pInp.wear,
          float: pInp.float,
          minF: pInp.skin.minF,
          maxF: pInp.skin.maxF,
          image: pInp.skin.image,
        },
      ];

      const singleOuts = buildOutcomes(
        [{ count: inputTotal, outs: pOS, n: pN }],
        prices,
        schema,
        inputTotal
      );

      const dk = `c|${pcid}|${pInp.skin.name}`;
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

      if (candidates.length >= CANDIDATE_CAP) break;

      const fillers: {
        cid: string;
        inp: InputCandidate;
        outs: SkinData[];
        n: number;
      }[] = [];

      for (const [fid, flist] of Object.entries(cheapIn)) {
        if (fid === pcid) continue;
        const rawFOuts = specialByCR[`${fid}|Extraordinary`] || [];
        if (!rawFOuts.length) continue;
        for (const f of flist) {
          if (f.skin.name === pInp.skin.name) continue;
          if (weaponOf(f.skin.name) === weaponOf(pInp.skin.name)) continue;
          const fN = norm(f.float, f.skin.minF, f.skin.maxF);
          const fOuts = pricedSpecialOutcomes(rawFOuts, fN, prices);
          if (!fOuts.length) continue;
          fillers.push({
            cid: fid,
            inp: f,
            outs: fOuts,
            n: fN,
          });
        }
      }

      fillers.sort((a, b) => a.inp.price - b.inp.price);
      const seenFillerSkins = new Set<string>();
      const diverseFillers: typeof fillers = [];
      for (const f of fillers) {
        if (seenFillerSkins.has(f.inp.skin.name)) continue;
        seenFillerSkins.add(f.inp.skin.name);
        diverseFillers.push(f);
        if (diverseFillers.length >= FILLER_CAP) break;
      }

      for (const f1 of diverseFillers) {
        if (candidates.length >= CANDIDATE_CAP) break;
        for (const sp of partitions(inputTotal, 2, 1)) {
          if (candidates.length >= CANDIDATE_CAP) break;
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
            schema,
            inputTotal
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
    if (candidates.length >= CANDIDATE_CAP) break;
  }

  const { target } = winChanceBandFromTarget(params.targetWinChance);
  return selectDiverseResults(candidates, limit, target);
}

function generateTierTradeUps(
  byCR: Record<string, SkinData[]>,
  prices: PriceMap,
  schema: SchemaData,
  params: GenerateParams,
  fee: number,
  inputTotal: number
): TradeUpResult[] {
  const candidates: TradeUpResult[] = [];
  const seenKeys = new Set<string>();
  const targetName =
    params.complexity === "standard" && params.targetOutcomeName?.trim()
      ? params.targetOutcomeName.trim()
      : "";
  const hunting = Boolean(targetName);
  // Target hunt: pull more input options + fillers so cheap mixes can undercut
  // expensive mono-collections (Rat Rod mono often can't profit).
  const SKINS_PER_POOL = hunting ? 8 : 4;
  const FILLER_CAP = hunting ? 16 : 10;
  const maxUnit = params.maxPrice / Math.max(2, inputTotal / 2);

  const targetPrev = targetName
    ? (() => {
        // Find target rarity from any pool that lists it
        for (const [key, list] of Object.entries(byCR)) {
          if (list.some((s) => s.name === targetName && !s.isSouvenir)) {
            const rarity = key.split("|")[1];
            return { rarity, prev: prevRarity(rarity) };
          }
        }
        return null;
      })()
    : null;

  const cheapIn: Record<string, InputCandidate[]> = {};

  for (const [key, list] of Object.entries(byCR)) {
    const options: InputCandidate[] = [];
    for (const skin of list) {
      const best = bestCandidateForSkin(skin, prices, maxUnit);
      if (best) options.push(best);
    }
    options.sort((a, b) => a.price - b.price);
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

    if (
      targetPrev?.prev &&
      (inR !== targetPrev.prev || nextR !== targetPrev.rarity)
    ) {
      continue;
    }

    const ci: Record<string, InputCandidate[]> = {};
    for (const [key, vals] of Object.entries(cheapIn)) {
      const [cid, rarity] = key.split("|");
      if (rarity === inR) ci[cid] = vals;
    }

    for (const [pcid, primaries] of Object.entries(ci)) {
      const pOS = byCR[`${pcid}|${nextR}`] || [];
      // Next-tier outcomes must be normal (non-souvenir) skins
      const pOuts = pOS.filter((s) => !s.isSouvenir);
      if (!pOuts.length) continue;

      // Target hunt: primary collection must be able to roll the skin
      if (targetName && !pOuts.some((s) => s.name === targetName)) continue;

      for (const pInp of primaries) {
        const pN = norm(pInp.float, pInp.skin.minF, pInp.skin.maxF);

        const singleInputs: TradeUpInput[] = [
          {
            name: pInp.skin.name,
            count: inputTotal,
            price: pInp.price,
            wear: pInp.wear,
            float: pInp.float,
            minF: pInp.skin.minF,
            maxF: pInp.skin.maxF,
            image: pInp.skin.image,
          },
        ];

        const singleOuts = buildOutcomes(
          [{ count: inputTotal, outs: pOuts, n: pN }],
          prices,
          schema,
          inputTotal
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
            prices,
            hunting
          );
          if (result) candidates.push(result);
        }

        // Skip mixed when mono can't clear ~1.2× — except target hunts, where
        // cheap fillers are how you get under the target's outcome ceiling.
        const bestOutP = Math.max(...singleOuts.map((o) => o.price), 0);
        if (!hunting && bestOutP < pInp.price * 1.2) continue;

        const fillers: {
          cid: string;
          inp: InputCandidate;
          outs: SkinData[];
          n: number;
          hasTarget: boolean;
        }[] = [];

        for (const [fid, flist] of Object.entries(ci)) {
          if (fid === pcid) continue;
          const fOuts = (byCR[`${fid}|${nextR}`] || []).filter(
            (s) => !s.isSouvenir
          );
          if (!fOuts.length) continue;
          const hasTarget = targetName
            ? fOuts.some((s) => s.name === targetName)
            : false;
          for (const f of flist) {
            if (f.skin.name === pInp.skin.name) continue;
            if (weaponOf(f.skin.name) === weaponOf(pInp.skin.name)) continue;
            fillers.push({
              cid: fid,
              inp: f,
              outs: fOuts,
              n: norm(f.float, f.skin.minF, f.skin.maxF),
              hasTarget,
            });
          }
        }

        // Target hunt: cheapest fillers first (cut cost). Otherwise prefer
        // co-target collections, then cheap.
        fillers.sort((a, b) => {
          if (hunting) {
            if (a.inp.price !== b.inp.price) return a.inp.price - b.inp.price;
            if (a.hasTarget !== b.hasTarget) return a.hasTarget ? -1 : 1;
            return 0;
          }
          if (targetName && a.hasTarget !== b.hasTarget) {
            return a.hasTarget ? -1 : 1;
          }
          return a.inp.price - b.inp.price;
        });

        const seenFillerSkins = new Set<string>();
        const diverseFillers: typeof fillers = [];
        for (const f of fillers) {
          if (seenFillerSkins.has(f.inp.skin.name)) continue;
          seenFillerSkins.add(f.inp.skin.name);
          diverseFillers.push(f);
          if (diverseFillers.length >= FILLER_CAP) break;
        }

        for (const f1 of diverseFillers) {
          const parts = partitions(inputTotal, 2, 1);
          // Hunt: try low primary counts first (more cheap filler → lower cost),
          // then higher hit% mixes. Non-hunt: keep original order.
          const orderedParts = hunting
            ? [...parts].sort(
                (a, b) => a[0] - b[0] || a[1] - b[1]
              )
            : parts;

          for (const sp of orderedParts) {
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
                { count: sp[0], outs: pOuts, n: pN },
                { count: sp[1], outs: f1.outs, n: f1.n },
              ],
              prices,
              schema,
              inputTotal
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
              prices,
              hunting
            );
            if (result) candidates.push(result);
          }
        }
      }
    }
  }

  return candidates;
}

/**
 * Drop lone cross-wear spikes without assuming FN≥MW≥FT≥WW≥BS order.
 * Example: CaliCamo WW $529 while other wears are cents → drop WW.
 * Blind Spot FT $124 while peers ~$15 → drop FT (old 12× threshold missed this).
 * Does NOT crush inverted ladders (First Class BS > FT) when the ratio
 * stays within a normal band.
 */
const WEAR_RANK: Record<string, number> = {
  "Factory New": 0,
  "Minimal Wear": 1,
  "Field-Tested": 2,
  "Well-Worn": 3,
  "Battle-Scarred": 4,
};

function wearFromPriceKey(key: string): string | null {
  const open = key.lastIndexOf(" (");
  if (open < 0 || !key.endsWith(")")) return null;
  return key.slice(open + 2, -1);
}

export function sanitizePrices(
  prices: PriceMap,
  _skinDB: SkinData[]
): PriceMap {
  const out: PriceMap = { ...prices };
  const byBase = new Map<string, string[]>();

  for (const key of Object.keys(out)) {
    const idx = key.lastIndexOf(" (");
    const base = idx > 0 ? key.slice(0, idx) : key;
    const list = byBase.get(base);
    if (list) list.push(key);
    else byBase.set(base, [key]);
  }

  for (const keys of byBase.values()) {
    if (keys.length < 2) continue;
    const vals = keys.map((k) => out[k]).filter((p) => p > 0);
    if (vals.length < 2) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    const mid =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    if (mid <= 0) continue;

    for (const key of keys) {
      const p = out[key];
      if (!(p > 0)) continue;
      // Spike vs peer median — sale outliers / ghost medians
      // 3.5× catches Blind Spot (~8×) while keeping mild wear ladders
      if (p > mid * 3.5 && p > mid + 5) {
        delete out[key];
      }
    }

    // FN ceiling — FT/WW/BS above Factory New is almost always a bad quote
    // (Glock AXIA BS ~$105 matching FN while real BS is ~$25–40).
    // Mild MW > FN is allowed (up to 1.2×). First Class BS-premium ladders
    // without FN are handled below with a looser better-wear cap.
    const priced = keys
      .map((key) => {
        const wear = wearFromPriceKey(key);
        const p = out[key];
        return wear && p > 0 ? { key, wear, p } : null;
      })
      .filter((x): x is { key: string; wear: string; p: number } => Boolean(x));

    const fn = priced.find((x) => x.wear === "Factory New")?.p || 0;

    for (const row of priced) {
      if (!(out[row.key] > 0)) continue;
      if (fn > 0) {
        if (row.wear === "Factory New") continue;
        if (row.wear === "Minimal Wear") {
          if (row.p > fn * 1.2) delete out[row.key];
        } else if (row.p > fn) {
          delete out[row.key];
        }
        continue;
      }

      // No FN: drop WW/BS that dominate every better wear (AXIA without FN)
      // but keep First Class-style BS premium over FT (70 vs 32).
      if (row.wear !== "Well-Worn" && row.wear !== "Battle-Scarred") continue;
      const rank = WEAR_RANK[row.wear];
      if (rank == null) continue;
      const better = priced
        .filter((x) => (WEAR_RANK[x.wear] ?? 99) < rank && out[x.key] > 0)
        .map((x) => out[x.key]);
      if (!better.length) continue;
      const betterMax = Math.max(...better);
      if (row.p > betterMax * 2.2 && row.p > betterMax + 10) {
        delete out[row.key];
      }
    }
  }

  return out;
}

/**
 * Re-apply live bulk prices to a trade-up and recompute EV / ROI / win%.
 * Shared by /api/refresh and post-generate so both paths match.
 *
 * Returns null when any input or outcome is unpriced — substituting 0 would
 * invent a free contract (totalCost 0, winPct 100%, fake positive EV).
 */
export function repriceTradeUp(
  tradeUp: TradeUpResult,
  prices: PriceMap
): TradeUpResult | null {
  const fee = tradeUp.fee;

  const inputs = tradeUp.inputs.map((input) => {
    // Never keep a stale optimistic quote after liquidity drops to zero
    const price = getPrice(prices, input.name, input.wear);
    return { ...input, price };
  });
  if (!inputs.length || inputs.some((i) => !(i.price > 0))) {
    return null;
  }

  const totalCost = r2(
    inputs.reduce((s, i) => s + i.price * i.count, 0)
  );
  if (!(totalCost > 0)) return null;

  const outcomes = tradeUp.outcomes
    .map((o) => {
      const price = getPrice(prices, o.name, o.wear);
      const profit = r2(price * (1 - fee) - totalCost);
      return { ...o, price, profit };
    })
    .sort((a, b) => b.price - a.price);

  if (!outcomes.length || outcomes.some((o) => !(o.price > 0))) {
    return null;
  }

  const { expectedValue, expectedProfit, roi } = metricsFromDisplayOutcomes(
    outcomes,
    totalCost,
    fee
  );

  let winPct = 0;
  let allWin = outcomes.length > 0;
  for (const o of outcomes) {
    if (o.profit >= 0) winPct += o.prob;
    else allWin = false;
  }
  winPct = allWin ? 100 : clampWinPct(winPct);

  return {
    ...tradeUp,
    inputs,
    outcomes,
    totalCost,
    expectedValue,
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
