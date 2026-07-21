export const SETTINGS_KEY = "tradeup-gen-settings";

export interface AppSettings {
  customExcludedCollections: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  customExcludedCollections: [],
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as AppSettings;
    return {
      customExcludedCollections: parsed.customExcludedCollections || [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
