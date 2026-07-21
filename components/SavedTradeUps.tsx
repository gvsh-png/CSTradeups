"use client";

import type { SavedTradeUp } from "@/lib/tradeup/types";
import TradeUpCard from "./TradeUpCard";

interface SavedTradeUpsProps {
  items: SavedTradeUp[];
  onRemove: (id: string) => void;
}

export default function SavedTradeUps({ items, onRemove }: SavedTradeUpsProps) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-surface-border flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium mb-1">No saved trade-ups</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-xs">
          Save trade-ups from the generator to keep track of contracts you want
          to execute.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <p className="text-xs text-[var(--text-muted)]">
        {items.length} saved trade-up{items.length !== 1 ? "s" : ""}
      </p>
      {items.map((item) => (
        <div key={item.id} className="relative group">
          <TradeUpCard
            tradeUp={item}
            onSave={() => {}}
            saved={true}
          />
          <button
            onClick={() => onRemove(item.id)}
            className="absolute top-4 right-14 sm:right-16 p-2 rounded-lg border border-surface-border text-[var(--text-muted)] hover:text-loss hover:border-loss/30 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
            title="Remove"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 px-1">
            Saved {new Date(item.savedAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}
