import axios from "axios";
import type { Brand, ScrapeNowResult } from "../types";
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
export async function startBrandDiscovery(website: string, seedName?: string): Promise<{ discoveryId: number; jobId: number }> {
  const client = await scraperClient();
  const res = await client.post("/brand-discovery/start", {
    mode: "scan_website",
    website,
    seed_name: seedName || undefined,
  });
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
