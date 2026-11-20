import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdminSessionState {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

/** Admin login (`/settings/login`, scraper_server) sets a `settings_session`
 * cookie, but app_server lives on a different hostname in production, so that
 * cookie never reaches it. Both servers' `require_admin` also accept an
 * `X-Session-Token` header (originally added for the Chrome extension) — the
 * dashboard replays the token here on every request so app_server admin
 * routes (brands, logo transform, …) authenticate too. */
export const useAdminSessionStore = create<AdminSessionState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clearToken: () => set({ token: null }),
    }),
    { name: "admin-session-storage" },
  ),
);
