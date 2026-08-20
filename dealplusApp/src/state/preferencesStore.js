import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

const usePreferencesStore = create()(
  persist(
    (set, get) => ({
      favoriteCategories: [],
      toggleCategory: (category) =>
        set((state) => ({
          favoriteCategories: state.favoriteCategories.includes(category)
            ? state.favoriteCategories.filter((c) => c !== category)
            : [...state.favoriteCategories, category],
        })),
    }),
    {
      name: 'preferences-storage',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default usePreferencesStore;
