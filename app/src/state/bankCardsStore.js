import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

/** Saved card: { id, bankId, cardType ('debit'|'credit'|'prepaid'), lastFour } */
const useBankCardsStore = create()(
  persist(
    (set, get) => ({
      cards: [],

      addCard: (bankId, cardType, lastFour) => {
        const id = `${bankId}-${lastFour}`;
        if (get().cards.find((c) => c.id === id)) return;
        set({ cards: [...get().cards, { id, bankId, cardType, lastFour }] });
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
