import { create } from 'zustand';
import { Storage } from './storage';
import { getRegion, DEFAULT_REGION, SUPPORTED_CODES } from '../config/regions';
import { detectCountry } from '../services/regionDetection';

const STORAGE_KEY = 'dealpulse:region';

const regionStore = create((set, get) => ({
  /** ISO country code, e.g. "PK" or "SA" */
  regionCode: DEFAULT_REGION,
  /** Full region config object from regions.js */
  region: getRegion(DEFAULT_REGION),
  /** true while the initial detection is running */
  detecting: false,

  /**
   * Called once on app start. Loads the saved region or auto-detects.
   * Safe to call multiple times — skips if already loaded.
   */
  initRegion: async () => {
    console.log('[Region] initRegion called');
    if (get().detecting) return;

    // Load saved preference first (instant)
    const saved = Storage.getString(STORAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved)) {
      console.log('[Region] loaded from storage:', saved);
      set({ regionCode: saved, region: getRegion(saved) });
      return;
    }

    // Auto-detect on first launch
    set({ detecting: true });
    try {
      const code = await detectCountry();
      const supported = SUPPORTED_CODES.includes(code) ? code : DEFAULT_REGION;
      Storage.set(STORAGE_KEY, supported);
      console.log('[Region] detected:', code, '→ using:', supported);
      set({ regionCode: supported, region: getRegion(supported), detecting: false });
    } catch {
      set({ detecting: false });
    }
  },

  /**
   * User manually picks a region from the Settings screen.
   * Persists the choice and updates the store.
   */
  setRegion: (isoCode) => {
    const code = isoCode?.toUpperCase();
    if (!SUPPORTED_CODES.includes(code)) return;
    Storage.set(STORAGE_KEY, code);
    set({ regionCode: code, region: getRegion(code) });
  },
}));

export default regionStore;

/** Convenience hook */
export const useRegion = () => regionStore((s) => s.region);
export const useRegionCode = () => regionStore((s) => s.regionCode);
export const useSetRegion = () => regionStore((s) => s.setRegion);
