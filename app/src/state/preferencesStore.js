import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

const usePreferencesStore = create()(
  persist(
    (set, get) => ({
      favoriteCategories: [],
      followedBrands: [],
      toggleCategory: (category) =>
        set((state) => ({
          favoriteCategories: state.favoriteCategories.includes(category)
            ? state.favoriteCategories.filter((c) => c !== category)
            : [...state.favoriteCategories, category],
        })),
      setFollowedBrands: (brands) => set({ followedBrands: brands }),
      toggleFollowedBrand: (name) =>
        set((state) => ({
          followedBrands: state.followedBrands.includes(name)
            ? state.followedBrands.filter((b) => b !== name)
            : [...state.followedBrands, name],
        })),
      /** Overwrites local prefs with the backend's copy — called on app load so a
       * fresh install (or preferences edited from another flow) stays in sync
       * with what's actually saved server-side. */
      hydrateFromServer: (brands, categories) => set({ followedBrands: brands, favoriteCategories: categories }),
    }),
    {
      name: 'preferences-storage',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default usePreferencesStore;
