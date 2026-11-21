// Single-offer AI verification runs on scraper_server (routers/offer_verify.py).
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { scraperClient } from "./client";
import { toast } from "../store/toastStore";

export interface VerifyResult {
  is_valid_offer: boolean;
  confidence: number;
  reason: string;
  status: "verified" | "suspicious" | "invalid";
}

export function useVerifyOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await scraperClient.post<VerifyResult>(`/offers/${id}/verify`);
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success(`Offer verified — ${result.status} (${result.confidence}% confidence).`);
    },
  });
}

// Bulk "verify all unverified offers" is now the "verify_offers" background
// job — see api/jobs.ts's useStartJob("verify_offers")/useActiveJob("verify_offers").
