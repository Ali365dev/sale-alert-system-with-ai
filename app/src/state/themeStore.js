import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

const useThemeStore = create()(
  persist(
    (set) => ({
      isDark: false,
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
      setDark: (isDark) => set({ isDark }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default useThemeStore;
