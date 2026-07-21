"use client";

import { useEffect, useRef, useState } from "react";

export type LoadStage = {
  /** Progress ceiling for this stage (0–100) */
  until: number;
  label: string;
};

const GENERATE_STAGES: LoadStage[] = [
  { until: 18, label: "Fetching live market prices…" },
  { until: 38, label: "Loading skin schema & collections…" },
  { until: 62, label: "Scoring trade-up contracts…" },
  { until: 82, label: "Filtering by ROI & price range…" },
  { until: 94, label: "Ranking best contracts…" },
  { until: 99, label: "Almost done…" },
];

const REFRESH_STAGES: LoadStage[] = [
  { until: 30, label: "Loading cached prices…" },
  { until: 65, label: "Updating skin prices…" },
  { until: 90, label: "Recalculating EV & ROI…" },
  { until: 98, label: "Finishing up…" },
];

export type ProgressKind = "generate" | "refresh";

function stagesFor(kind: ProgressKind): LoadStage[] {
  return kind === "generate" ? GENERATE_STAGES : REFRESH_STAGES;
}

/** Expected wall time used for ETA (ms) */
function expectedMs(kind: ProgressKind): number {
  return kind === "generate" ? 22_000 : 4_500;
}

export type ProgressState = {
  percent: number;
  label: string;
  elapsedMs: number;
  remainingMs: number;
  remainingLabel: string;
};

function formatRemaining(ms: number, elapsedMs: number, expected: number): string {
  if (elapsedMs > expected * 1.15) return "still working…";
  if (ms <= 0) return "almost done…";
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `~${sec}s left`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `~${min}m ${rem}s left` : `~${min}m left`;
}

/**
 * Simulated but steady progress while a request is in flight.
 * Advances through labeled stages and never stalls visually.
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
    const stages = stagesFor(kind);

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      setElapsedMs(elapsed);

      // Ease toward 99% over expected duration, never quite finish until active=false
      const t = Math.min(1, elapsed / expected);
      // ease-out cubic so early progress feels snappy
      const eased = 1 - Math.pow(1 - t, 2.2);
      let target = Math.min(99, 2 + eased * 97);

      // Soft cap at current stage ceiling so labels sync with bar
      const stage = stages.find((s) => target <= s.until) || stages[stages.length - 1];
      target = Math.min(target, stage.until);

      setPercent((prev) => {
        // Always move forward a little so the bar never freezes
        const next = Math.max(prev, target);
        const nudge = prev < 98 ? Math.min(98, prev + 0.08) : prev;
        return Math.max(next, nudge);
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

  return {
    percent: Math.round(percent),
    label: active ? label : "",
    elapsedMs,
    remainingMs,
    remainingLabel: active
      ? formatRemaining(remainingMs, elapsedMs, expected)
      : "",
  };
}
