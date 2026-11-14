import type { TakhfifBusinessDetail } from "../types/takhfif";
import { KEYS, get, log, set } from "./takhfif-store";

type DetailsStore = Record<string, TakhfifBusinessDetail>;

interface PushResult { ok: boolean; error?: string; saved?: number }

/** POSTs one reviewed business (native detail JSON) to the scraper server's
 * /api/bank-offers/import. Uses fetch — axios' XHR adapter doesn't exist in
 * a MV3 service worker. */
async function postBusiness(detail: TakhfifBusinessDetail): Promise<{ ok: boolean; error?: string }> {
  const settings = await get<{ scraperServerUrl?: string; sessionToken?: string }>("dm_settings");
  if (!settings?.scraperServerUrl || !settings.sessionToken) {
    return { ok: false, error: "Backend not configured — set server URL and session token in Settings." };
  }
  try {
    const res = await fetch(`${settings.scraperServerUrl}/api/bank-offers/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": settings.sessionToken },
      body: JSON.stringify(detail),
    });
    const data = await res.json().catch(() => null) as { error?: string; offers_saved?: number; brand_name?: string | null } | null;
    if (!res.ok) return { ok: false, error: data?.error ?? `Backend save failed (HTTP ${res.status}).` };
    await log("success",
      `${detail.name} saved to backend — ${data?.offers_saved ?? 0} offer row(s)${data?.brand_name ? `, matched brand "${data.brand_name}"` : ""}.`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Backend save failed: ${err instanceof Error ? err.message : "network error"}.` };
  }
}

export async function pushTakhfifBusiness(slug: string): Promise<PushResult> {
  const store = (await get<DetailsStore>(KEYS.details)) ?? {};
  const detail = store[slug];
  if (!detail) return { ok: false, error: "No scraped details for this business yet." };
  const res = await postBusiness(detail);
  if (!res.ok) {
    await log("error", `${detail.name}: ${res.error}`);
    return { ok: false, error: res.error };
  }
  detail.pushedAt = new Date().toISOString();
  await set({ [KEYS.details]: store });
  return { ok: true, saved: 1 };
}

export async function pushAllTakhfifBusinesses(): Promise<PushResult> {
  const store = (await get<DetailsStore>(KEYS.details)) ?? {};
  const pending = Object.values(store)
    .filter((d) => !d.pushedAt || d.scrapedAt > d.pushedAt);
  if (!pending.length) return { ok: false, error: "Everything is already synced." };

  let saved = 0;
  let lastError: string | undefined;
  for (const detail of pending) {
    const res = await postBusiness(detail);
    if (res.ok) {
      detail.pushedAt = new Date().toISOString();
      saved++;
      await set({ [KEYS.details]: store }); // incremental — badges update live
    } else {
      lastError = res.error;
      await log("error", `${detail.name}: ${res.error}`);
      if (res.error?.includes("not configured")) break; // no point retrying the rest
    }
  }
  await log(saved ? "success" : "error",
    `Backend sync finished — ${saved}/${pending.length} business(es) saved.`);
  return saved
    ? { ok: true, saved }
    : { ok: false, error: lastError ?? "No businesses were saved." };
}
