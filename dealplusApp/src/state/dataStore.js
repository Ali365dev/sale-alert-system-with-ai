import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

const useDataStore = create()(
  persist(
    (set, get) => ({
      brands: [],
      deals: [],
      categories: [],
      brandsById: {},
      loading: true,
      error: null,
      setBrandsAndDeals: (brands, deals, brandsById) => set({ brands, deals, brandsById }),
      setCategories: (categories) => set({ categories }),
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
        brandsById: state.brandsById,
      }),
    },
  ),
);

export default useDataStore;
