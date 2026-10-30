import axios, { type AxiosInstance } from "axios";

import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";

// ── Base URLs ────────────────────────────────────────────────────────────────
// VITE_APP_SERVER_URL  → app server  (auth, brands, offers, emails, analytics…)
// VITE_SCRAPER_SERVER_URL → scraper server (website-scraper, social-scraper, brand-discovery)
//
// In dev both default to localhost. In prod set these in dashboard/.env (or
// Vercel env vars) to your two Render service URLs.
const DEFAULT_APP_URL = import.meta.env.PROD
  ? "https://sales-alert-app.onrender.com/api"
  : "http://localhost:8000/api";

const DEFAULT_SCRAPER_URL = import.meta.env.PROD
  ? "https://sales-alert-scraper.onrender.com/api"
  : "http://localhost:8001/api";

const APP_BASE_URL     = import.meta.env.VITE_APP_SERVER_URL     ?? DEFAULT_APP_URL;
const SCRAPER_BASE_URL = import.meta.env.VITE_SCRAPER_SERVER_URL ?? DEFAULT_SCRAPER_URL;

// ── Shared interceptor wiring ─────────────────────────────────────────────────
function addInterceptors(client: AxiosInstance) {
  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const data = error.response?.data;
      if (data?.error === "not authenticated") return Promise.reject(error);
      const detail = typeof data?.detail === "string" ? data.detail : undefined;
      const message =
        data?.error ??
        detail ??
        (data?.status === "already_running" ? "Already running — please wait for it to finish." : undefined) ??
        error.message ??
        "Something went wrong. Please try again.";
      toast.error(message);
      return Promise.reject(error);
    },
  );
}

// ── App server client — auth, brands, offers, emails, analytics, jobs… ───────
export const apiClient = axios.create({
  baseURL: APP_BASE_URL,
  withCredentials: true, // needed for Settings' httpOnly session cookie
});
addInterceptors(apiClient);

// ── Scraper server client — website-scraper, social-scraper, brand-discovery ─
export const scraperClient = axios.create({
  baseURL: SCRAPER_BASE_URL,
  withCredentials: true,
});
addInterceptors(scraperClient);
