import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import App from "./App.tsx";
import { initClarity } from "./lib/clarity.ts";
import "./styles/index.css";

initClarity();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid treating every page mount as a cold load (full-page “Loading…” flash).
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying a 4xx (404, 429 rate limit) only repeats the same answer and,
      // for 429s, deepens the rate limit.
      retry: (failureCount, error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
