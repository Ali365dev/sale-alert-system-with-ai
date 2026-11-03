import type { AppSettings, ScrapeHistoryEntry } from "../types";

const SETTINGS_KEY = "dm_settings";
const HISTORY_KEY = "dm_history";

const IS_DEV = typeof process !== "undefined" && process.env.NODE_ENV === "development";

const DEFAULT_SETTINGS: AppSettings = {
  appServerUrl: IS_DEV
    ? "http://localhost:8000"
    : "https://sale-alert-system-with-ai.onrender.com",
  scraperServerUrl: IS_DEV
    ? "http://localhost:8001"
    : "https://sale-alert-system-with-ai-1.onrender.com",
  sessionToken: null,
};

export async function getSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<AppSettings> ?? {}) });
    });
  });
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...partial } }, resolve);
  });
}

export async function clearSession(): Promise<void> {
  return saveSettings({ sessionToken: null });
}

export async function isAuthenticated(): Promise<boolean> {
  const s = await getSettings();
  return !!s.sessionToken;
}

export async function getHistory(): Promise<ScrapeHistoryEntry[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(HISTORY_KEY, (result) => {
      resolve((result[HISTORY_KEY] as ScrapeHistoryEntry[]) ?? []);
    });
  });
}

export async function addHistoryEntry(entry: ScrapeHistoryEntry): Promise<void> {
  const history = await getHistory();
  const updated = [entry, ...history].slice(0, 50);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [HISTORY_KEY]: updated }, resolve);
  });
}

export async function clearHistory(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(HISTORY_KEY, resolve);
  });
}
