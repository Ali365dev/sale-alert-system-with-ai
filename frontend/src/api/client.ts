import axios from "axios";

import { toast } from "../store/toastStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api",
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
