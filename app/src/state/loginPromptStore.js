import { create } from 'zustand';

/** Global “sign in to favorite” prompt — presented from App root sheet. */
const useLoginPromptStore = create((set) => ({
  open: false,
  kind: 'deal', // 'deal' | 'store'
  show: (kind = 'deal') => set({ open: true, kind: kind === 'store' ? 'store' : 'deal' }),
  hide: () => set({ open: false }),
}));

export default useLoginPromptStore;
