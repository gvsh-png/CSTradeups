"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SavedTradeUp, TradeUpResult } from "@/lib/tradeup/types";
import { STORAGE_KEY } from "@/lib/constants";
import { loadSettings, saveSettings, type AppSettings } from "@/lib/settings";
import { useAuth } from "./AuthProvider";

type SavedContextValue = {
  saved: SavedTradeUp[];
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  isSaved: (id: string) => boolean;
  saveTradeUp: (
    tradeUp: TradeUpResult,
    openUpgrade: (reason?: string) => void
  ) => Promise<boolean>;
  removeSaved: (id: string) => Promise<void>;
  updateSaved: (item: SavedTradeUp) => void;
  updateInsight: (id: string, insight: string | undefined) => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const {
    authConfigured,
    authRequired,
    user,
    claimSave,
    releaseSave,
    syncSavedCount,
    limits,
  } = useAuth();

  const [saved, setSaved] = useState<SavedTradeUp[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const persistSaved = useCallback((items: SavedTradeUp[]) => {
    setSaved(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw) as SavedTradeUp[]);
    } catch {
      /* ignore */
    }
    setSettingsState(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !authConfigured || !user) return;
    void syncSavedCount(saved.length).then((result) => {
      if (!result.ok && result.error) {
        const max = limits.freeMaxSaved;
        if (saved.length > max) {
          persistSaved(saved.slice(0, max));
          void syncSavedCount(max);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, authConfigured, user?.steamId]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const setSettings = useCallback((s: AppSettings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);

  const isSaved = useCallback(
    (id: string) => saved.some((s) => s.id === id),
    [saved]
  );

  const saveTradeUp = useCallback(
    async (
      tradeUp: TradeUpResult,
      openUpgrade: (reason?: string) => void
    ): Promise<boolean> => {
      if (saved.some((s) => s.id === tradeUp.id)) return false;

      if (authConfigured && authRequired && !user) {
        openUpgrade("Sign in with Steam to save trade-ups.");
        return false;
      }

      if (authConfigured && user) {
        const claimed = await claimSave();
        if (!claimed.ok) {
          openUpgrade(claimed.error);
          return false;
        }
      }

      persistSaved([
        { ...tradeUp, savedAt: new Date().toISOString() },
        ...saved,
      ]);
      return true;
    },
    [
      saved,
      authConfigured,
      authRequired,
      user,
      claimSave,
      persistSaved,
    ]
  );

  const removeSaved = useCallback(
    async (id: string) => {
      if (!saved.some((s) => s.id === id)) return;
      const next = saved.filter((s) => s.id !== id);
      persistSaved(next);
      showToast("Removed from saved");
      if (authConfigured && user) await releaseSave();
    },
    [saved, persistSaved, authConfigured, user, releaseSave, showToast]
  );

  const updateSaved = useCallback(
    (item: SavedTradeUp) => {
      persistSaved(saved.map((s) => (s.id === item.id ? item : s)));
    },
    [saved, persistSaved]
  );

  const updateInsight = useCallback(
    (id: string, insight: string | undefined) => {
      persistSaved(
        saved.map((s) => {
          if (s.id !== id) return s;
          if (insight === undefined) {
            const { insight: _removed, ...rest } = s;
            return rest as SavedTradeUp;
          }
          return { ...s, insight };
        })
      );
    },
    [saved, persistSaved]
  );

  const value = useMemo(
    () => ({
      saved,
      settings,
      setSettings,
      isSaved,
      saveTradeUp,
      removeSaved,
      updateSaved,
      updateInsight,
    }),
    [
      saved,
      settings,
      setSettings,
      isSaved,
      saveTradeUp,
      removeSaved,
      updateSaved,
      updateInsight,
    ]
  );

  return (
    <SavedContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-20 left-1/2 z-[80] -translate-x-1/2 md:bottom-8"
        >
          <div className="animate-toast-in rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2 text-[11px] font-mono text-[var(--text)] shadow-[0_12px_32px_-16px_rgba(0,0,0,0.85)]">
            {toast}
          </div>
        </div>
      )}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within SavedProvider");
  return ctx;
}
