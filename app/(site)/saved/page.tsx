"use client";

import Link from "next/link";
import SavedTradeUps from "@/components/SavedTradeUps";
import { useSaved } from "@/components/SavedProvider";

export default function SavedPage() {
  const { saved, removeSaved, updateSaved } = useSaved();

  return (
    <div className="mx-auto max-w-container px-4 sm:px-6 py-5 lg:py-8">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="label text-accent/80 mb-1">Library</p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Saved contracts
          </h1>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">
            Refresh prices or share builds you want to run.
          </p>
        </div>
        <Link href="/generate" className="btn-accent-outline hidden sm:inline-flex">
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
