import type { SavedTradeUp, TradeUpResult } from "./tradeup/types";

/**
 * When background live Steam reprice finishes, overlay matching saved
 * favorites with the live-priced contracts (same id). Preserves savedAt/note
 * and any insight that live results omit. Without this, saving during
 * "matching Steam Starting at…" permanently stores bulk prices/EV under an
 * id that isSaved() still treats as saved.
 */
export function applyLiveResultsToSaved(
  saved: SavedTradeUp[],
  liveResults: TradeUpResult[]
): { next: SavedTradeUp[]; updatedIds: string[] } {
  if (!saved.length || !liveResults.length) {
    return { next: saved, updatedIds: [] };
  }

  const byId = new Map(liveResults.map((r) => [r.id, r]));
  const updatedIds: string[] = [];
  const next = saved.map((s) => {
    const live = byId.get(s.id);
    if (!live) return s;
    updatedIds.push(s.id);
    const merged: SavedTradeUp = {
      ...live,
      savedAt: s.savedAt,
    };
    if (s.note != null) merged.note = s.note;
    if (live.insight == null && s.insight != null) {
      merged.insight = s.insight;
    }
    return merged;
  });

  return { next, updatedIds };
}
