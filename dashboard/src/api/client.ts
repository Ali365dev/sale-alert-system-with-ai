import axios from "axios";

import { toast } from "../store/toastStore";

// VITE_API_BASE_URL (dashboard/.env, gitignored) always wins when set — lets
// a local override point at a different backend (e.g. testing against a
// deployed API, or vice versa). Otherwise the default is picked from the
// build mode itself: `vite build` (what Vercel runs) sets import.meta.env.PROD,
// `vite dev` doesn't — so a deployed dashboard talks to the deployed API and
// a local dashboard talks to your local API with zero env-file setup needed.
const DEFAULT_API_BASE_URL = import.meta.env.PROD
  ? "https://sale-alert-system-with-ai.onrender.com/api"
  : "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  withCredentials: true, // needed for the Settings module's httpOnly session cookie
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    // Routine "not logged into Settings yet" 401s are expected on every page
    // load while signed out — not a real error, so no toast for these.
    if (data?.error === "not authenticated") {
      return Promise.reject(error);
    }
    const message =
      data?.error ??
      (data?.status === "already_running" ? "Already running — please wait for it to finish." : undefined) ??
      error.message ??
      "Something went wrong. Please try again.";
    toast.error(message);
    return Promise.reject(error);
  },
);
