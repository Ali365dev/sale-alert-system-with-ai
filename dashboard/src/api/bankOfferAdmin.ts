import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { scraperClient } from "./client";
import { toast } from "../store/toastStore";
import type { BankOfferRow } from "./bankOffers";

export interface BankCardSummary {
  card_name: string | null;
  offers_count: number;
  max_discount: number | null;
  avg_discount: number | null;
}

export interface BankSummary {
  bank_name: string;
  bank_logo: string | null;
  offers_count: number;
  active_count: number;
  expired_count: number;
  businesses_count: number;
  max_discount: number | null;
  cards: BankCardSummary[];
}

export interface BusinessInput {
  name?: string;
  category?: string | null;
  city?: string | null;
  description?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  is_active?: boolean;
}

export interface OfferInput {
  business_id?: number;
  bank_name?: string;
  bank_logo?: string | null;
  card_name?: string | null;
  discount_percentage?: number | null;
  max_discount_amount?: number | null;
  max_discount_text?: string | null;
  currency?: string | null;
  expiry_date?: string | null;
  description?: string | null;
  valid_days?: string[];
  terms?: string[];
  is_active?: boolean;
}

export type BulkOfferAction = "delete" | "activate" | "deactivate";

function invalidateAll(queryClient: QueryClient) {
  for (const key of ["bank-offers-list", "bank-offer-businesses", "bank-offer-business", "bank-offer-banks", "combined-offers"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

function useAdminMutation<TVars, TData = unknown>(
  mutationFn: (vars: TVars) => Promise<TData>,
  successMessage: (vars: TVars, data: TData) => string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data, vars) => {
      invalidateAll(queryClient);
      toast.success(successMessage(vars, data));
    },
  });
}

export function useBanks() {
  return useQuery({
    queryKey: ["bank-offer-banks"],
    queryFn: async () => {
      const { data } = await scraperClient.get<{ banks: BankSummary[] }>("/bank-offers/banks");
      return data.banks;
    },
  });
}

export function useCreateBusiness() {
  return useAdminMutation(
    async (input: BusinessInput) => (await scraperClient.post<{ id: number; name: string }>("/bank-offers/businesses", input)).data,
    (_v, d) => `${d.name} created.`,
  );
}

export function useUpdateBusiness() {
  return useAdminMutation(
    async ({ id, input }: { id: number; input: BusinessInput }) =>
      (await scraperClient.patch(`/bank-offers/businesses/${id}`, input)).data,
    () => "Business updated.",
  );
}

export function useCreateOffer() {
  return useAdminMutation(
    async (input: OfferInput) => (await scraperClient.post<BankOfferRow>("/bank-offers/offers", input)).data,
    () => "Offer added.",
  );
}

export function useUpdateOffer() {
  return useAdminMutation(
    async ({ id, input }: { id: number; input: OfferInput }) =>
      (await scraperClient.patch<BankOfferRow>(`/bank-offers/offers/${id}`, input)).data,
    () => "Offer updated.",
  );
}

export function useDeleteOffer() {
  return useAdminMutation(
    async (id: number) => (await scraperClient.delete(`/bank-offers/offers/${id}`)).data,
    () => "Offer deleted.",
  );
}

export function useBulkOffers() {
  return useAdminMutation(
    async ({ ids, action }: { ids: number[]; action: BulkOfferAction }) =>
      (await scraperClient.post<{ affected: number }>("/bank-offers/offers/bulk", { ids, action })).data,
    ({ action }, d) => `${d.affected} offer${d.affected === 1 ? "" : "s"} ${action === "delete" ? "deleted" : `${action}d`}.`,
  );
}

export function useUpdateBank() {
  return useAdminMutation(
    async ({ bankName, input }: { bankName: string; input: { new_name?: string; bank_logo?: string | null; is_active?: boolean } }) =>
      (await scraperClient.patch<{ updated: number }>("/bank-offers/banks", input, { params: { bank_name: bankName } })).data,
    (_v, d) => `Bank updated (${d.updated} offers).`,
  );
}

export function useDeleteBank() {
  return useAdminMutation(
    async (bankName: string) =>
      (await scraperClient.delete<{ deleted: number }>("/bank-offers/banks", { params: { bank_name: bankName } })).data,
    (_v, d) => `Bank removed (${d.deleted} offers).`,
  );
}

function cardParams(bankName: string, cardName: string | null) {
  return cardName == null ? { bank_name: bankName } : { bank_name: bankName, card_name: cardName };
}

export function useUpdateCard() {
  return useAdminMutation(
    async ({ bankName, cardName, input }: { bankName: string; cardName: string | null; input: { new_card_name?: string | null; is_active?: boolean } }) =>
      (await scraperClient.patch<{ updated: number }>("/bank-offers/cards", input, { params: cardParams(bankName, cardName) })).data,
    (_v, d) => `Card updated (${d.updated} offers).`,
  );
}

export function useDeleteCard() {
  return useAdminMutation(
    async ({ bankName, cardName }: { bankName: string; cardName: string | null }) =>
      (await scraperClient.delete<{ deleted: number }>("/bank-offers/cards", { params: cardParams(bankName, cardName) })).data,
    (_v, d) => `Card removed (${d.deleted} offers).`,
  );
}
