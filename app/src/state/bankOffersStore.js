import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

/** Scraped bank-card offers (takhfif.app, via services/bankOffersApi.js),
 * persisted so the Bank Offers screen has something to show immediately on
 * a cold start while the fetch is in flight. */
const useBankOffersStore = create()(
  persist(
    (set) => ({
      offers: [],
      loading: false,
      error: null,

      setOffers: (offers) => set({ offers, loading: false, error: null }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error, loading: false }),
    }),
    {
      name: 'bank-offers-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ offers: state.offers }),
    },
  ),
);

export default useBankOffersStore;
