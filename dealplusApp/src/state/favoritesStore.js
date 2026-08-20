import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

const useFavoritesStore = create()(
  persist(
    (set, get) => ({
      favoriteIds: [],
      isFavorite: (id) => get().favoriteIds.includes(id),
      toggleFavorite: (id) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((f) => f !== id)
            : [...state.favoriteIds, id],
        })),
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default useFavoritesStore;
