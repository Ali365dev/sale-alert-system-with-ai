import axios from "axios";
import type { ScrapedOffer, ApiOffer, SaveResult } from "../types";
import { getSettings, saveSettings, clearSession } from "./storage";

async function appClient() {
  const { appServerUrl, sessionToken } = await getSettings();
  return axios.create({
    baseURL: `${appServerUrl}/api`,
    timeout: 8000,
    headers: sessionToken ? { "X-Session-Token": sessionToken } : {},
  });
}

async function scraperClient() {
  const { scraperServerUrl, sessionToken } = await getSettings();
  return axios.create({
    baseURL: `${scraperServerUrl}/api`,
    timeout: 8000,
    headers: sessionToken ? { "X-Session-Token": sessionToken } : {},
  });
}

/** Authenticate and persist the session token.
 * Settings auth lives on scraper_server (port 8001), not app_server.
 * The login endpoint returns the token in the JSON body so we don't need
 * cookie access (browsers block setting Cookie headers from JS). */
export async function login(password: string): Promise<void> {
  const { scraperServerUrl } = await getSettings();

  const res = await fetch(`${scraperServerUrl}/api/settings/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const body = await res.json().catch(() => ({})) as { status?: string; token?: string; error?: string };

  if (!res.ok) {
    throw new Error(body.error || "Login failed");
  }

  if (!body.token) {
    throw new Error("Server did not return a session token");
  }

  await saveSettings({ sessionToken: body.token });
}

export async function logout(): Promise<void> {
  try {
    const client = await scraperClient();
    await client.post("/settings/logout");
  } catch {
    // ignore network errors on logout
  }
  await clearSession();
}

export async function checkSession(): Promise<boolean> {
  try {
    const client = await scraperClient();
    const res = await client.get("/settings/session");
    return (res.data as { authenticated?: boolean }).authenticated === true;
  } catch {
    return false;
  }
}

export async function listBrands(): Promise<{ id: number; name: string }[]> {
  const client = await appClient();
  const res = await client.get("/brands");
  return (res.data as { brands: { id: number; name: string }[] }).brands ?? [];
}

export async function saveOffer(offer: ScrapedOffer): Promise<ApiOffer> {
  const client = await appClient();
  const payload = {
    title: offer.title,
    brand: offer.brand || null,
    category: offer.category || null,
    subcategory: offer.subcategory || null,
    discount_percentage: offer.discount_percentage || null,
    coupon_code: offer.coupon_code || null,
    expiry_date: offer.expiry_date || null,
    offer_value: offer.sale_price ? `${offer.sale_price}` : null,
    website: offer.offer_url,
    summary: offer.description || null,
    image_url: offer.image_url || null,
    is_active: true,
    source: "chrome_extension",
    source_url: offer.source_url,
  };
  const res = await client.post("/offers", payload);
  return res.data as ApiOffer;
}

export async function saveOffers(offers: ScrapedOffer[]): Promise<SaveResult[]> {
  const results: SaveResult[] = [];
  for (const offer of offers) {
    const saved = await saveOffer(offer);
    results.push({ offer: saved, alreadyExists: false });
  }
  return results;
}

export async function verifyOffer(offerId: number): Promise<void> {
  const client = await appClient();
  await client.post(`/offers/${offerId}/verify`);
}

/** Trigger a server-side scrape via scraper_server */
export async function triggerServerScrape(url: string): Promise<{ jobId: number }> {
  const client = await scraperClient();
  const res = await client.post("/website-scraper/scrape-now", { url });
  return res.data as { jobId: number };
}

/** Ping both health endpoints to check connectivity */
export async function testConnection(): Promise<{ appServer: boolean; scraperServer: boolean }> {
  const settings = await getSettings();
  const [app, scraper] = await Promise.allSettled([
    fetch(`${settings.appServerUrl}/api/health`, { signal: AbortSignal.timeout(5000) }),
    fetch(`${settings.scraperServerUrl}/api/health`, { signal: AbortSignal.timeout(5000) }),
  ]);
  return {
    appServer: app.status === "fulfilled" && app.value.ok,
    scraperServer: scraper.status === "fulfilled" && scraper.value.ok,
  };
}
