"use client";

import { useEffect, useState } from "react";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "@/lib/settings";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}

export default function SettingsPanel({
  open,
  onClose,
  onChange,
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [allCollections, setAllCollections] = useState<
    { key: string; name: string }[]
  >([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSettings(loadSettings());
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => {
        if (d.allCollections) setAllCollections(d.allCollections);
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const filtered = allCollections.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.key.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (key: string) => {
    const next = settings.customExcludedCollections.includes(key)
      ? settings.customExcludedCollections.filter((k) => k !== key)
      : [...settings.customExcludedCollections, key];
    const updated = { ...settings, customExcludedCollections: next };
    setSettings(updated);
    saveSettings(updated);
    onChange(updated);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close settings"
      />
      <div className="relative w-full sm:max-w-md max-h-[85dvh] overflow-hidden panel rounded-t-xl sm:rounded-xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-[var(--border)] shrink-0">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] text-sm font-mono"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto scrollbar-thin flex-1">
          <div>
            <p className="label mb-1">Custom excluded collections</p>
            <p className="text-[11px] text-[var(--text-muted)] mb-3 leading-relaxed">
              Always skip these in generation, even if older than 30 days.
            </p>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections…"
              className="input-field mb-3"
            />
            {settings.customExcludedCollections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {settings.customExcludedCollections.map((key) => {
                  const name =
                    allCollections.find((c) => c.key === key)?.name || key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      className="text-[10px] font-mono px-2 py-1 rounded-md border border-accent/30 text-accent bg-accent/5"
                    >
                      {name} ×
                    </button>
                  );
                })}
              </div>
            )}
            <ul className="max-h-52 overflow-y-auto scrollbar-thin space-y-0.5 border border-[var(--border)] rounded-md p-2">
              {filtered.slice(0, 50).map((c) => {
                const checked = settings.customExcludedCollections.includes(
                  c.key
                );
                return (
                  <li key={c.key}>
                    <label className="flex items-center gap-2.5 py-1.5 px-1.5 rounded-md hover:bg-[var(--surface)] cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.key)}
                        className="shrink-0"
                      />
                      <span className="text-[11px] truncate">{c.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
