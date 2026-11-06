import axios from "axios";
import { getSettings } from "./storage";

async function scraperClient() {
  const { scraperServerUrl, sessionToken } = await getSettings();
  return axios.create({
    baseURL: `${scraperServerUrl}/api`,
    timeout: 10000,
    headers: sessionToken ? { "X-Session-Token": sessionToken } : {},
  });
}

export interface ManualBankOfferRow {
  bank_name: string;
  card_name?: string;
  discount_percentage?: string;
  expiry_date?: string;
}

/** Domains with a dedicated, fully-automated server-side scraper
 * (services/takhfif_scraper.py's JSON-LD pipeline) — no visual picking
 * needed at all. BankOffersTab shows a one-click "Run Scrape" option for
 * these instead of (not in place of — both stay available) the manual
 * pick/scan/review flow. */
export const AUTOMATED_SCRAPE_DOMAINS = ["takhfif.app"];

/** Triggers the server-side takhfif.app scrape job — see
 * routers/bank_offers.py's /scrape endpoint and jobs/scrape_takhfif.py.
 * maxPages defaults to a small test run; the full catalog is 101 pages. */
export async function triggerTakhfifScrape(maxPages: number): Promise<{ jobId: number }> {
  const client = await scraperClient();
  const res = await client.post("/bank-offers/scrape", { max_pages: maxPages });
  return { jobId: (res.data as { jobId: number }).jobId };
}

/** Saves bank-card offer rows extracted by the visual picker from the
 * current page (Bank Offers mode) — see routers/bank_offers.py's /manual
 * endpoint on scraper_server. Brand matching + replace-by-source-url
 * semantics are the same as the automated takhfif.app scrape job. */
export async function saveManualBankOffers(payload: {
  source_url: string;
  place_name: string;
  place_website?: string;
  offers: ManualBankOfferRow[];
}): Promise<{ saved: number }> {
  const client = await scraperClient();
  const res = await client.post("/bank-offers/manual", payload);
  return res.data as { saved: number };
}
