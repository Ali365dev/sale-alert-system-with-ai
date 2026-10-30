import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

const MAX_RECENT = 8;

const useSearchHistoryStore = create(
  persist(
    (set) => ({
      recentSearches: [],
      rememberSearch: (term) => {
        const next = (term || '').trim();
        if (!next) return;
        set((state) => ({
          recentSearches: [next, ...state.recentSearches.filter((s) => s.toLowerCase() !== next.toLowerCase())].slice(0, MAX_RECENT),
        }));
      },
      clearSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'search-history',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default useSearchHistoryStore;
