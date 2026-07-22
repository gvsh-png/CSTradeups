"use client";

import type { ProgressState } from "@/hooks/useSimulatedProgress";

type Props = {
  progress: ProgressState;
  title?: string;
  compact?: boolean;
};

/** Industrial Precision loading — Computing Outcomes modal with corner brackets */
export default function LoadingProgress({
  progress,
  title = "Computing Outcomes",
  compact = false,
}: Props) {
  const { percent, label, remainingMs, elapsedMs } = progress;
  const etaSec = Math.max(1, Math.ceil(remainingMs / 1000));
  const rate = (3.6 + (percent / 100) * 1.4).toFixed(1);

  if (compact) {
    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
          <span className="text-accent truncate">{label || title}</span>
          <span className="text-[var(--text-muted)] tabular-nums shrink-0">
            {percent}% · {progress.remainingLabel}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-highest)]">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </div>
      </div>
    );
  }

  const ring = 2 * Math.PI * 36;
  const dash = (percent / 100) * ring;

  return (
    <div className="relative">
      {/* Dimmed skeleton feed behind modal — matches Stitch loading screen */}
      <div className="absolute inset-x-0 top-0 space-y-3 opacity-35 pointer-events-none select-none blur-[0.5px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-low)] p-3"
          >
            <div className="flex gap-3">
              <div className="h-12 w-12 shrink-0 rounded-lg bg-[var(--surface-highest)]" />
              <div className="flex-1 space-y-2 pt-1">
                <div
                  className="h-2.5 rounded bg-[var(--surface-highest)]"
                  style={{ width: `${50 + i * 14}%` }}
                />
                <div className="h-2 rounded bg-[var(--surface-highest)] w-2/5" />
              </div>
            </div>
            {i === 1 && (
              <div className="mt-3 h-0.5 w-full bg-[var(--tertiary)]/50 rounded-full" />
            )}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex justify-center py-6 sm:py-10">
        <div className="corner-frame panel panel-glow w-full max-w-sm mx-auto px-6 py-8 text-center">
          <span className="corner-bl" aria-hidden />
          <span className="corner-br" aria-hidden />

          {/* Circular progress + chip */}
          <div className="relative mx-auto h-24 w-24 mb-5">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80" aria-hidden>
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="var(--surface-highest)"
                strokeWidth="4"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${ring}`}
                className="transition-[stroke-dasharray] duration-150 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-accent">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M9 3v2H7a2 2 0 00-2 2v2H3v2h2v2H3v2h2v2a2 2 0 002 2h2v2h2v-2h2v2h2v-2h2a2 2 0 002-2v-2h2v-2h-2v-2h2V9h-2V7a2 2 0 00-2-2h-2V3h-2v2h-2V3H9zm0 4h6v10H9V7z" />
              </svg>
            </div>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)]">
            {title}
          </h3>
          <p className="mt-2 text-[13px] text-accent font-medium leading-snug">
            {label || "Fetching live market prices…"}
          </p>

          <div className="mt-6 space-y-2 text-left">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
              <span className="text-[var(--text)]">Progress</span>
              <span className="text-accent font-bold tabular-nums text-[13px]">
                {percent}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-highest)]">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 text-[11px] font-mono text-[var(--text-soft)]">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Rate: ~{rate}k/s
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 7v5l3 2" />
              </svg>
              ETA: {etaSec}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
