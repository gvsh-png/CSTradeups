import type { Complexity } from "../constants";

export interface SkinData {
  name: string;
  minF: number;
  maxF: number;
  rarity: string;
  collections: { id: string; name: string }[];
  image?: string;
  /** Souvenir market listing (Souvenir Weapon | Paint) */
  isSouvenir?: boolean;
  /** Knife / glove special item */
  isSpecial?: boolean;
  /** How many equal CS2 outcome slots this market name represents (Doppler phases) */
  outcomeWeight?: number;
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
  /** Target win chance % the user asked for (e.g. 60 → ~60% win contracts) */
  targetWinChance: number;
  /** Minimum probability (%) that a random outcome is profitable after fees */
  minWinChance: number;
  /** Maximum win chance % for the scan band */
  maxWinChance: number;
  complexity: Complexity;
  feeType: "steam" | "csfloat";
  excludeUnstableCollections?: boolean;
  limit?: number;
  /**
   * Standard mode only — exact outcome market name ("Weapon | Paint").
   * Generator ranks contracts by chance of landing this skin first.
   */
  targetOutcomeName?: string;
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
      /** Present when this paint exists as a Souvenir drop */
      souvenir?: boolean;
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
