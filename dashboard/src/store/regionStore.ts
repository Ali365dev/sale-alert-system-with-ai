import { create } from "zustand";

const STORAGE_KEY = "dashboard:region";

export const COUNTRIES = [
  { code: "PK", name: "Pakistan",     flag: "🇵🇰" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "AE", name: "UAE",          flag: "🇦🇪" },
  { code: "QA", name: "Qatar",        flag: "🇶🇦" },
  { code: "KW", name: "Kuwait",       flag: "🇰🇼" },
  { code: "OM", name: "Oman",         flag: "🇴🇲" },
  { code: "BH", name: "Bahrain",      flag: "🇧🇭" },
  { code: "EG", name: "Egypt",        flag: "🇪🇬" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

interface RegionState {
  region: CountryCode | null; // null = all countries
  setRegion: (code: CountryCode | null) => void;
}

function load(): CountryCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return COUNTRIES.some((c) => c.code === v) ? (v as CountryCode) : null;
  } catch {
    return null;
  }
}

export const useRegionStore = create<RegionState>((set) => ({
  region: load(),
  setRegion: (code) => {
    try {
      if (code) localStorage.setItem(STORAGE_KEY, code);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
    set({ region: code });
  },
}));
