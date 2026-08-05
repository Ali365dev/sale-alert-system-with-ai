import { create } from "zustand";

const STORAGE_KEY = "favorite-offers";

function load(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function persist(ids: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

interface FavoritesState {
  ids: Set<number>;
  toggle: (id: number) => void;
  isFavorite: (id: number) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(load()),
  toggle: (id) =>
    set((state) => {
      const ids = new Set(state.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      persist(Array.from(ids));
      return { ids };
    }),
  isFavorite: (id) => get().ids.has(id),
}));
