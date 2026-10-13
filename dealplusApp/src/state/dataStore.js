import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

const useDataStore = create()(
  persist(
    (set, get) => ({
      brands: [],
      deals: [],
      categories: [],
      alerts: [],
      brandsById: {},
      // True only for a cold empty store. Cleared after MMKV rehydrate when a
      // catalog cache exists so screens don't flash skeletons on every open.
      loading: true,
      error: null,
      setBrandsAndDeals: (brands, deals, brandsById) => set({ brands, deals, brandsById }),
      setCategories: (categories) => set({ categories }),
      setAlerts: (alerts) => set({ alerts }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'data-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        brands: state.brands,
        deals: state.deals,
        categories: state.categories,
        alerts: state.alerts,
        brandsById: state.brandsById,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && (state.brands?.length > 0 || state.deals?.length > 0)) {
          useDataStore.setState({ loading: false });
        }
      },
    },
  ),
);

export default useDataStore;
