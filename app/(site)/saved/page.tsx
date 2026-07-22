"use client";

import Link from "next/link";
import SavedTradeUps from "@/components/SavedTradeUps";
import { useSaved } from "@/components/SavedProvider";

export default function SavedPage() {
  const { saved, removeSaved, updateSaved } = useSaved();

  return (
    <div className="mx-auto max-w-container px-4 sm:px-6 py-5 lg:py-8">
      <div className="flex items-end justify-between gap-4 mb-5 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Saved contracts
            </h1>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-1 sm:ml-3">
            Refresh prices or share builds you want to run.
          </p>
        </div>
        <Link href="/generate" className="btn-primary w-auto px-4 h-9 hidden sm:inline-flex">
          New scan
        </Link>
      </div>

      <SavedTradeUps
        items={saved}
        onRemove={(id) => void removeSaved(id)}
        onUpdate={updateSaved}
      />
    </div>
  );
}
