import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
