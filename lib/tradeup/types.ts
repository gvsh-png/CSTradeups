import type { Complexity } from "../constants";

export interface SkinData {
  name: string;
  minF: number;
  maxF: number;
  rarity: string;
  collections: { id: string; name: string }[];
  image?: string;
}

export interface TradeUpInput {
  name: string;
  count: number;
  price: number;
  wear: string;
  float: number;
  minF: number;
  maxF: number;
  maxFloat?: number;
  image?: string;
}

export interface TradeUpOutcome {
  name: string;
  float: number;
  wear: string;
  price: number;
  prob: number;
  profit: number;
  image?: string;
  outMinF: number;
  outMaxF: number;
}

export interface TradeUpResult {
  id: string;
  type: "single" | "mixed";
  inputs: TradeUpInput[];
  outcomes: TradeUpOutcome[];
  totalCost: number;
  expectedValue: number;
  expectedProfit: number;
  roi: number;
  winPct: number;
  avgWin: number;
  avgLoss: number;
  inputRarity: string;
  outputRarity: string;
  complexity: Complexity;
  description: string;
  fee: number;
  generatedAt: string;
  /** Cached AI insight — cleared on price refresh so users can request a new one */
  insight?: string;
}

export interface GenerateParams {
  minPrice: number;
  maxPrice: number;
  /** Minimum probability (%) that a random outcome is profitable after fees */
  minWinChance: number;
  complexity: Complexity;
  feeType: "steam" | "csfloat";
  excludeUnstableCollections?: boolean;
  limit?: number;
}

export interface PriceMap {
  [marketHashName: string]: number;
}

export interface SchemaWeapon {
  name: string;
  type?: string;
  paints?: Record<
    string,
    {
      name: string;
      rarity: number;
      min?: number;
      max?: number;
      collections?: string[];
      image?: string;
    }
  >;
}

export interface SchemaData {
  collections: { key: string; name: string }[];
  weapons: Record<string, SchemaWeapon>;
}

export interface SavedTradeUp extends TradeUpResult {
  savedAt: string;
  note?: string;
}
