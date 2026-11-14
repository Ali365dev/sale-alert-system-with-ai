import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

/** Saved card: { id, bankId, cardType, lastFour, cardName?, imageIdx?, network? } */
const useBankCardsStore = create()(
  persist(
    (set, get) => ({
      cards: [],

      addCard: (bankId, cardType, lastFour, extra = {}) => {
        const id = `${bankId}-${lastFour}-${extra.cardName ?? cardType}`;
        if (get().cards.find((c) => c.id === id)) return;
        set({ cards: [...get().cards, { id, bankId, cardType, lastFour, ...extra }] });
      },

      removeCard: (id) => set({ cards: get().cards.filter((c) => c.id !== id) }),
    }),
    {
      name: 'bank-cards-storage',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default useBankCardsStore;
