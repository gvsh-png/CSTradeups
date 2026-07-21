"use client";

import type { ProgressState } from "@/hooks/useSimulatedProgress";

type Props = {
  progress: ProgressState;
  title?: string;
  compact?: boolean;
};

/** Full-panel loading UI with percent, ETA, and live status copy */
export default function LoadingProgress({
  progress,
  title = "Working…",
  compact = false,
}: Props) {
  const { percent, label, remainingLabel, elapsedMs } = progress;
  const elapsedSec = Math.max(1, Math.floor(elapsedMs / 1000));

  if (compact) {
    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
          <span className="text-accent truncate">{label || title}</span>
          <span className="text-[var(--text-muted)] tabular-nums shrink-0">
            {percent}% · {remainingLabel}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--text-muted)] leading-snug">
            {label}
          </p>
        </div>
        <div className="text-right shrink-0 font-mono">
          <p className="text-lg font-bold tabular-nums text-accent">{percent}%</p>
          <p className="text-[10px] text-[var(--text-muted)] tabular-nums">
            {remainingLabel}
          </p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[var(--text-muted)]">
        <span>Still working · not stuck</span>
        <span className="tabular-nums">elapsed {elapsedSec}s</span>
      </div>

      {/* Skeleton cards so the layout feels alive */}
      <div className="space-y-2 pt-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 opacity-60"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="flex gap-3 animate-pulse">
              <div className="h-10 w-10 shrink-0 rounded bg-[var(--border)]" />
              <div className="flex-1 space-y-2">
                <div
                  className="h-2.5 rounded bg-[var(--border)]"
                  style={{ width: `${55 + i * 12}%` }}
                />
                <div className="h-2 rounded bg-[var(--border)] w-2/5" />
              </div>
              <div className="h-8 w-14 shrink-0 rounded bg-[var(--border)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
