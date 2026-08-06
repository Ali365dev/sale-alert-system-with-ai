import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface PreferencesContextValue {
  favoriteCategories: string[];
  toggleCategory: (category: string) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([]);

  const toggleCategory = useCallback((category: string) => {
    setFavoriteCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const value = useMemo(
    () => ({ favoriteCategories, toggleCategory }),
    [favoriteCategories, toggleCategory]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
