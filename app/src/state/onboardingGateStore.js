import { create } from 'zustand';
import { Storage } from './storage';

const HAS_ONBOARDED_KEY = 'dealpulse:hasOnboarded';
const HAS_SELECTED_COUNTRY_KEY = 'dealpulse:hasSelectedCountry';

/** Whether the user has completed the onboarding flow — gates which screen the app boots into.
 * Reads MMKV synchronously so the gate is correct on the very first render (no flash of onboarding
 * for returning users while a persisted store rehydrates). */
const useOnboardingGateStore = create((set) => ({
  hasOnboarded: Storage.getString(HAS_ONBOARDED_KEY) === 'true',
  hasSelectedCountry: Storage.getString(HAS_SELECTED_COUNTRY_KEY) === 'true',
  completeOnboarding: () => {
    Storage.set(HAS_ONBOARDED_KEY, 'true');
    set({ hasOnboarded: true });
  },
  completeCountrySelection: () => {
    Storage.set(HAS_SELECTED_COUNTRY_KEY, 'true');
    set({ hasSelectedCountry: true });
  },
}));

export default useOnboardingGateStore;
