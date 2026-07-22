"use client";

import { useEffect, useRef, useState } from "react";

export type LoadStage = {
  /** Progress ceiling for this stage (0–100) */
  until: number;
  label: string;
};

const GENERATE_STAGES: LoadStage[] = [
  { until: 16, label: "Fetching live market prices…" },
  { until: 34, label: "Loading skin schema & collections…" },
  { until: 55, label: "Scoring trade-up contracts…" },
  { until: 72, label: "Filtering by risk chance & price…" },
  { until: 86, label: "Ranking best contracts…" },
  { until: 94, label: "Finalizing results…" },
  { until: 99, label: "Still working — large scan…" },
];

const REFRESH_STAGES: LoadStage[] = [
  { until: 28, label: "Loading cached prices…" },
  { until: 58, label: "Updating skin prices…" },
  { until: 82, label: "Recalculating EV & ROI…" },
  { until: 96, label: "Finishing up…" },
];

export type ProgressKind = "generate" | "refresh";

function stagesFor(kind: ProgressKind): LoadStage[] {
  return kind === "generate" ? GENERATE_STAGES : REFRESH_STAGES;
}

/** Expected wall time used for ETA (ms) — cold price cache can be slow */
function expectedMs(kind: ProgressKind): number {
  return kind === "generate" ? 45_000 : 6_000;
}

export type ProgressState = {
  percent: number;
  label: string;
  elapsedMs: number;
  remainingMs: number;
  remainingLabel: string;
  overdue: boolean;
};

function formatRemaining(
  remainingMs: number,
  elapsedMs: number,
  expected: number
): string {
  // Past expected window — never claim "1s left"
  if (elapsedMs >= expected * 0.92) {
    return "still working…";
  }
  if (remainingMs <= 1500) return "still working…";
  const sec = Math.ceil(remainingMs / 1000);
  if (sec < 60) return `~${sec}s left`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `~${min}m ${rem}s left` : `~${min}m left`;
}

/**
 * Simulated progress while a request is in flight.
 * Approaches ~90% over the expected window, then crawls slowly so we
 * never sit on "99% · ETA 1s" while the API is still running.
 */
export function useSimulatedProgress(
  active: boolean,
  kind: ProgressKind = "generate"
): ProgressState {
  const [percent, setPercent] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setPercent(0);
      setElapsedMs(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startRef.current = performance.now();
    setPercent(2);
    setElapsedMs(0);

    const expected = expectedMs(kind);

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      setElapsedMs(elapsed);

      const t = elapsed / expected;
      let target: number;

      if (t < 1) {
        // Ease toward 90% over expected duration — leave headroom
        const eased = 1 - Math.pow(1 - Math.min(1, t), 1.65);
        target = 3 + eased * 87; // → ~90%
      } else {
        // Overdue: crawl from 90 → 97 very slowly (never fake 99 early)
        const overtime = elapsed - expected;
        const crawl = Math.min(7, Math.log1p(overtime / 8000) * 3.2);
        target = 90 + crawl;
      }

      target = Math.min(97, target);

      setPercent((prev) => {
        const next = Math.max(prev, target);
        // Tiny forward nudge so the bar never freezes before 90%
        if (prev < 88) return Math.min(88, Math.max(next, prev + 0.04));
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, kind]);

  const stages = stagesFor(kind);
  const label =
    stages.find((s) => percent <= s.until)?.label ||
    stages[stages.length - 1].label;

  const expected = expectedMs(kind);
  const remainingMs = Math.max(0, expected - elapsedMs);
  const overdue = elapsedMs >= expected * 0.92;

  return {
    percent: Math.round(percent),
    label: active ? label : "",
    elapsedMs,
    remainingMs,
    remainingLabel: active
      ? formatRemaining(remainingMs, elapsedMs, expected)
      : "",
    overdue,
  };
}
