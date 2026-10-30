import { create } from 'zustand';

const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Transient selections made while walking through the onboarding flow — not persisted. */
const useOnboardingStore = create((set, get) => ({
  topics: [],
  brandIds: [],
  toggleTopic: (topic) => set({ topics: toggle(get().topics, topic) }),
  toggleBrand: (id) => set({ brandIds: toggle(get().brandIds, id) }),
}));

export default useOnboardingStore;
