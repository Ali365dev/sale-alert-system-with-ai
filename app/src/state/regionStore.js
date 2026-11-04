import { create } from 'zustand';
import { Storage } from './storage';
import { getRegion, DEFAULT_REGION, SUPPORTED_CODES } from '../config/regions';
import { detectCountry, detectFromGPS } from '../services/regionDetection';

const STORAGE_KEY = 'dealpulse:region';

const regionStore = create((set, get) => ({
  /** ISO country code, e.g. "PK" or "SA" */
  regionCode: DEFAULT_REGION,
  /** Full region config object from regions.js */
  region: getRegion(DEFAULT_REGION),
  /** true while the initial detection is running */
  detecting: false,
  /** true if any detection signal (SIM/locale/IP) found the country automatically */
  autoDetected: false,

  /**
   * Called once on app start. Loads the saved region or auto-detects.
   * Safe to call multiple times — skips if already loaded.
   */
  initRegion: async () => {
    console.log('[Region] initRegion called');
    if (get().detecting) return;

    // Load saved preference first (instant) — treat a previously saved region
    // as auto-detected so the country screen is not shown again on re-install.
    const saved = Storage.getString(STORAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved)) {
      console.log('[Region] loaded from storage:', saved);
      set({ regionCode: saved, region: getRegion(saved), autoDetected: true });
      return;
    }

    // Auto-detect on first launch
    set({ detecting: true });
    try {
      const { code, autoDetected } = await detectCountry();
      const supported = SUPPORTED_CODES.includes(code) ? code : DEFAULT_REGION;
      Storage.set(STORAGE_KEY, supported);
      console.log('[Region] detected:', code, '→ using:', supported, '| autoDetected:', autoDetected);
      set({ regionCode: supported, region: getRegion(supported), detecting: false, autoDetected });
    } catch {
      set({ detecting: false });
    }
  },

  /**
   * Runs GPS detection (after location permission was granted) and updates
   * the store if a country is found. No-op if already auto-detected.
   * Sets detecting=true while running so the welcome screen keeps its spinner.
   */
  tryGPSDetection: async () => {
    if (get().autoDetected || get().detecting) return;
    set({ detecting: true });
    try {
      const code = await detectFromGPS();
      if (code) {
        const supported = SUPPORTED_CODES.includes(code) ? code : DEFAULT_REGION;
        Storage.set(STORAGE_KEY, supported);
        console.log('[Region] GPS detection →', code, '→ using:', supported);
        set({ regionCode: supported, region: getRegion(supported), autoDetected: true, detecting: false });
      } else {
        set({ detecting: false });
      }
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
