import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface FavoritesContextValue {
  favoriteIds: string[];
  isFavorite: (dealId: string) => boolean;
  toggleFavorite: (dealId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const toggleFavorite = useCallback((dealId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId]
    );
  }, []);

  const isFavorite = useCallback((dealId: string) => favoriteIds.includes(dealId), [favoriteIds]);

  const value = useMemo(
    () => ({ favoriteIds, isFavorite, toggleFavorite }),
    [favoriteIds, isFavorite, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
