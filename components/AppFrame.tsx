"use client";

import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import type { AppSettings } from "@/lib/settings";
import AppShell from "./AppShell";
import SettingsPanel from "./SettingsPanel";
import UpgradeModal from "./UpgradeModal";
import { useAuth } from "./AuthProvider";
import { useSaved } from "./SavedProvider";

type FrameCtx = {
  openUpgrade: (reason?: string) => void;
  openSettings: () => void;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
};

const AppFrameContext = createContext<FrameCtx | null>(null);

export function useAppFrame() {
  const ctx = useContext(AppFrameContext);
  if (!ctx) throw new Error("useAppFrame must be used within AppFrame");
  return ctx;
}

function FrameInner({
  children,
  hideMobileTabs,
}: {
  children: ReactNode;
  hideMobileTabs?: boolean;
}) {
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const { settings, setSettings } = useSaved();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  useEffect(() => {
    const auth = searchParams.get("auth");
    const billing = searchParams.get("billing");
    if (auth === "ok" || billing === "success") void refresh();
  }, [searchParams, refresh]);

  const openUpgrade = (reason?: string) => {
    setUpgradeReason(reason ?? null);
    setUpgradeOpen(true);
  };

  return (
    <AppFrameContext.Provider
      value={{
        openUpgrade,
        openSettings: () => setSettingsOpen(true),
        settings,
        setSettings,
      }}
    >
      <AppShell onUpgrade={() => openUpgrade()} hideMobileTabs={hideMobileTabs}>
        {children}
      </AppShell>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
      />

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </AppFrameContext.Provider>
  );
}

export default function AppFrame({
  children,
  hideMobileTabs,
}: {
  children: ReactNode;
  hideMobileTabs?: boolean;
}) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <FrameInner hideMobileTabs={hideMobileTabs}>{children}</FrameInner>
    </Suspense>
  );
}
