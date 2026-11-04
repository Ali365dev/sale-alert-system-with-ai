import axios from "axios";
import type { Brand, ScrapeNowResult, ListingConfig } from "../types";
import { getSettings } from "./storage";

async function appClient() {
  const { appServerUrl, sessionToken } = await getSettings();
  return axios.create({
    baseURL: `${appServerUrl}/api`,
    timeout: 10000,
    headers: sessionToken ? { "X-Session-Token": sessionToken } : {},
  });
}

async function scraperClient() {
  const { scraperServerUrl, sessionToken } = await getSettings();
  return axios.create({
    baseURL: `${scraperServerUrl}/api`,
    timeout: 10000,
    headers: sessionToken ? { "X-Session-Token": sessionToken } : {},
  });
}

export async function listCategories(): Promise<string[]> {
  const client = await appClient();
  const res = await client.get("/categories");
  const cats = (res.data as { categories: { name: string }[] }).categories ?? [];
  return cats.map((c) => c.name);
}

export async function listBrands(): Promise<Brand[]> {
  const client = await appClient();
  const res = await client.get("/brands");
  return (res.data as { brands: Brand[] }).brands ?? [];
}

export async function createBrand(data: {
  name: string;
  website: string;
  country: string;
  logo_url?: string;
}): Promise<Brand> {
  const client = await appClient();
  const res = await client.post("/brands", {
    ...data,
    is_active: true,
    website_scraping_enabled: true,
  });
  return res.data as Brand;
}

/** Trigger a server-side scrape by brand_id (or fallback url). */
export async function triggerBrandScrape(brandId: number): Promise<ScrapeNowResult> {
  const client = await scraperClient();
  const res = await client.post("/website-scraper/scrape-now", { brand_id: brandId });
  return res.data as ScrapeNowResult;
}

/** Trigger a scrape for multiple brands sequentially. Returns array of jobIds. */
export async function triggerMultiBrandScrape(brandIds: number[]): Promise<number[]> {
  const jobIds: number[] = [];
  for (const id of brandIds) {
    try {
      const result = await triggerBrandScrape(id);
      jobIds.push(result.jobId);
    } catch {
      // skip failed triggers; caller shows error
    }
  }
  return jobIds;
}

/** Start a brand discovery job from a URL (async pipeline on scraper server). */
export async function startBrandDiscovery(
  website: string,
  seedName?: string,
  pageHtml?: string,
): Promise<{ discoveryId: number; jobId: number }> {
  const client = await scraperClient();
  const res = await client.post("/brand-discovery/start", pageHtml
    ? { mode: "html_content", website, seed_name: seedName || undefined, page_html: pageHtml }
    : { mode: "scan_website", website, seed_name: seedName || undefined },
  );
  return res.data as { discoveryId: number; jobId: number };
}

/** Poll a brand discovery record by id. */
export async function getBrandDiscovery(discoveryId: number): Promise<{
  id: number;
  status: string;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  country: string | null;
  description: string | null;
  duplicate_brand_id: number | null;
  duplicate_brand?: { id: number; name: string; website: string | null } | null;
  error: string | null;
}> {
  const client = await scraperClient();
  const res = await client.get(`/brand-discovery/${discoveryId}`);
  return res.data;
}

/** Find or create a ScraperConfig for a brand+domain, return config id. */
export async function getOrCreateScraperConfig(brandId: number | null, domain: string): Promise<number> {
  const client = await scraperClient();
  const listRes = await client.get("/scraper-configs", {
    params: brandId != null ? { brand_id: brandId } : {},
  });
  const configs = (listRes.data as { configs: { id: number; name: string }[] }).configs ?? [];
  if (configs.length > 0) return configs[0].id;

  const createRes = await client.post("/scraper-configs", {
    brand_id: brandId,
    name: domain,
    start_urls: [`https://${domain}`],
    max_pages: 20,
    max_depth: 3,
    request_delay: 1.5,
  });
  return (createRes.data as { id: number }).id;
}

/** Fetch all saved offers for a brand (source=website). */
export async function getBrandOffers(brandId: number): Promise<import("../types").ApiOffer[]> {
  const client = await scraperClient();
  const res = await client.get(`/website-scraper/brands/${brandId}/offers`);
  return (res.data as { offers: import("../types").ApiOffer[] }).offers ?? [];
}

/**
 * Save a full listing config (container + fields + pagination) to the backend.
 * Creates or updates a ScraperConfig, then bulk-upserts ScraperSelectors.
 */
export async function saveListingConfig(config: ListingConfig): Promise<void> {
  const client = await scraperClient();

  // Upsert the ScraperConfig record
  let configId = config.id;
  if (!configId) {
    const domain = config.listingUrl
      ? (() => { try { return new URL(config.listingUrl).hostname; } catch { return "listing"; } })()
      : "listing";
    const res = await client.post("/scraper-configs", {
      brand_id: config.brandId ?? null,
      name: config.name || domain,
      start_urls: config.listingUrl ? [config.listingUrl] : [],
      max_pages: config.pagination.maxPages ?? 10,
      request_delay: (config.pagination.pageLoadDelay ?? 1500) / 1000,
    });
    configId = (res.data as { id: number }).id;
  }

  // Build selectors array from the listing config
  type SelDef = { name: string; selector_type: string; css_selector: string; attribute?: string; multiple: boolean };
  const selectors: SelDef[] = [];

  selectors.push({ name: "container", selector_type: "container", css_selector: config.containerSelector, multiple: true });

  const fieldTypeMap: Record<string, string> = {
    title: "text", url: "link", image: "image",
    currentPrice: "price", originalPrice: "price",
    discount: "text", availability: "text", sku: "attribute",
  };

  for (const [key, field] of Object.entries(config.fields)) {
    if (!field?.css) continue;
    selectors.push({
      name: key,
      selector_type: fieldTypeMap[key] ?? "text",
      css_selector: field.css,
      attribute: field.attr !== "text" ? field.attr : undefined,
      multiple: false,
    });
  }

  if (config.pagination.method !== "none" && config.pagination.nextSelector) {
    selectors.push({
      name: "pagination_next",
      selector_type: "pagination",
      css_selector: config.pagination.nextSelector,
      multiple: false,
    });
  }

  // Post selectors (replace all — backend handles upsert by name)
  await client.put(`/scraper-configs/${configId}/selectors`, { selectors });
}

/** Update editable fields on a BrandDiscovery row. */
export async function updateBrandDiscovery(
  id: number,
  patch: Partial<{ name: string; website: string; logo_url: string; description: string; category: string; subcategory: string; country: string }>,
): Promise<void> {
  const client = await scraperClient();
  await client.put(`/brand-discovery/${id}`, patch);
}

/** Save (create or merge) a completed discovery into Brands. */
export async function saveBrandDiscovery(
  id: number,
  action: "create" | "merge",
  targetBrandId?: number,
): Promise<{ brand_id: number; brand_name: string }> {
  const client = await scraperClient();
  const res = await client.post(`/brand-discovery/${id}/save`, {
    action,
    ...(targetBrandId != null ? { target_brand_id: targetBrandId } : {}),
  });
  return res.data as { brand_id: number; brand_name: string };
}

/** Discard a discovery record. */
export async function discardBrandDiscovery(id: number): Promise<void> {
  const client = await scraperClient();
  await client.delete(`/brand-discovery/${id}`);
}

/** Search DuckDuckGo for brand candidates by name. */
export async function searchBrandCandidates(brandName: string): Promise<Array<{
  name: string; website: string; domain: string;
  logo_url: string | null; description: string | null; category: string;
}>> {
  const client = await scraperClient();
  const res = await client.post("/brand-discovery/search-candidates", { brand_name: brandName });
  return (res.data as { candidates: unknown[] }).candidates as Array<{
    name: string; website: string; domain: string;
    logo_url: string | null; description: string | null; category: string;
  }>;
}

/** Save a CSS selector into a ScraperConfig. */
export async function saveScraperSelector(
  configId: number,
  selector: { name: string; selector_type: string; css_selector: string; multiple?: boolean },
): Promise<void> {
  const client = await scraperClient();
  await client.post(`/scraper-configs/${configId}/selectors`, {
    ...selector,
    multiple: selector.multiple ?? false,
    enabled: true,
  });
}
