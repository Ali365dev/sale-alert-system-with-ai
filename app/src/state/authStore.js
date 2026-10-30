import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

/** Optional real-account layer on top of the app's device-scoped guest mode
 * (see preferencesStore/deviceId) — nothing here is required for the app to
 * work; a signed-out user is just a guest, same as before this existed. */
const useAuthStore = create()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default useAuthStore;
