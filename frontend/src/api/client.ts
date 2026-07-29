import axios from "axios";

import { toast } from "../store/toastStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api",
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const message =
      data?.error ??
      (data?.status === "already_running" ? "Already running — please wait for it to finish." : undefined) ??
      error.message ??
      "Something went wrong. Please try again.";
    toast.error(message);
    return Promise.reject(error);
  },
);
