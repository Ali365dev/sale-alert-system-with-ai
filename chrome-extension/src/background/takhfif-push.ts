import type { BusinessDetail, TakhfifBusinessDetail } from "../types/takhfif";
import { KEYS, get, log, set } from "./takhfif-store";

type DetailsStore = Record<string, TakhfifBusinessDetail>;

interface PushResult { ok: boolean; error?: string; saved?: number }

/** Maps the internal TakhfifBusinessDetail (camelCase, nested tiers) to the
 * standard BusinessDetail payload (snake_case, flat cards) for backend import. */
function detailToStandardPayload(detail: TakhfifBusinessDetail): BusinessDetail {
  return {
    business_id: detail.slug,
    name: detail.name,
    category: detail.category,
    city: detail.city,
    description: detail.description,
    rating: detail.rating,
    phone: detail.phone,
    website: detail.website,
    logo_url: detail.logoImage,
    cover_image_url: detail.coverImage,
    source_url: detail.canonicalUrl || detail.sourceUrl,
    banks: (detail.banks || []).map((bank) => ({
      bank_name: bank.bankName,
      bank_logo: undefined,
      validity_text: bank.validityText ?? undefined,
      cards: (bank.tiers || []).flatMap((tier) =>
        (tier.cards || []).map((card) => ({
          card_name: card.cardName,
          discount_percentage: card.discountPercentage ?? tier.discountPercentage ?? null,
          maximum_discount: card.maxDiscountAmount ?? null,
          valid_days: tier.title && !/\%\s*off/i.test(tier.title) ? tier.title : undefined,
          terms_and_conditions: (bank.terms || []).join("; ") || undefined,
          currency: card.currency,
          valid_through: card.validThrough ?? undefined,
        }))
      ),
    })),
    branches: (detail.branches || []).map((br) => ({
      name: br.name,
      address: br.address,
      latitude: br.latitude,
      longitude: br.longitude,
      directions_url: br.directionsUrl,
      place_id: br.placeId,
    })),
  };
}

async function postBusinesses(payload: BusinessDetail[]): Promise<{ ok: boolean; error?: string; saved?: number }> {
  const settings = await get<{ scraperServerUrl?: string; sessionToken?: string }>("dm_settings");
  if (!settings?.scraperServerUrl || !settings.sessionToken) {
    return { ok: false, error: "Backend not configured — set server URL and session token in Settings." };
  }
  try {
    const res = await fetch(`${settings.scraperServerUrl}/api/bank-offers/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": settings.sessionToken },
      body: JSON.stringify({ businesses: payload }),
    });
    const data = await res.json().catch(() => null) as { error?: string; saved?: number; errors?: string[] } | null;
    if (!res.ok) return { ok: false, error: data?.error ?? `Backend save failed (HTTP ${res.status}).` };
    return { ok: true, saved: data?.saved ?? payload.length };
  } catch (err) {
    return { ok: false, error: `Backend save failed: ${err instanceof Error ? err.message : "network error"}.` };
  }
}

export async function pushTakhfifBusiness(slug: string): Promise<PushResult> {
  const store = (await get<DetailsStore>(KEYS.details)) ?? {};
  const detail = store[slug];
  if (!detail) return { ok: false, error: "No scraped details for this business yet." };

  const payload = detailToStandardPayload(detail);
  const res = await postBusinesses([payload]);
  if (!res.ok) {
    await log("error", `${detail.name}: ${res.error}`);
    return { ok: false, error: res.error };
  }
  await log("success", `${detail.name} saved to backend — ${res.saved ?? 1} business(es).`);
  detail.pushedAt = new Date().toISOString();
  await set({ [KEYS.details]: store });
  return { ok: true, saved: 1 };
}

export async function pushAllTakhfifBusinesses(): Promise<PushResult> {
  const store = (await get<DetailsStore>(KEYS.details)) ?? {};
  const pending = Object.values(store)
    .filter((d) => !d.pushedAt || d.scrapedAt > d.pushedAt);
  if (!pending.length) return { ok: false, error: "Everything is already synced." };

  const payload = pending.map(detailToStandardPayload);
  const res = await postBusinesses(payload);
  if (!res.ok) {
    await log("error", `Backend sync failed: ${res.error}`);
    return { ok: false, error: res.error };
  }

  const now = new Date().toISOString();
  for (const detail of pending) {
    detail.pushedAt = now;
  }
  await set({ [KEYS.details]: store });
  await log("success", `Backend sync finished — ${res.saved ?? pending.length}/${pending.length} business(es) saved.`);
  return { ok: true, saved: res.saved ?? pending.length };
}
