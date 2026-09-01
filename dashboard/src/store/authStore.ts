import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

/** Optional real-account layer on top of the public site's guest browsing —
 * nothing here is required for the site to work; a signed-out visitor is
 * just a guest, same as before this existed. Mirrors dealplusApp's
 * src/state/authStore.js so the two clients share the same mental model. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: "auth-storage" },
  ),
);
