import { useState } from "react";

import { useBrands } from "../api/brands";
import { useJob } from "../api/jobs";
import { useScrapeNow, useWebsiteJobPages } from "../api/websiteScraper";
import { ScrapeDetailPanel } from "../components/websiteScraper/ScrapeDetailPanel";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FieldGroup, Label, Select, TextInput } from "../components/ui/Field";

/** Manual testing workflow (spec §18): pick a brand and/or paste a URL, run
 * the full pipeline once, and inspect every stage's result. Mirrors
 * SocialScraperTest.tsx's shape. */
export function WebsiteScraperTest() {
  const { data: brandsData } = useBrands();
  const [brandId, setBrandId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const scrapeNow = useScrapeNow();
  const { data: job } = useJob(activeJobId);
  const isProcessing = job && (job.status === "pending" || job.status === "running" || job.status === "cancelling");

  const resolvedBrandId = brandId ? Number(brandId) : null;
  const { data: pages } = useWebsiteJobPages(isProcessing === false ? activeJobId : null);
  const latestPage = pages && pages.length > 0 ? pages[0] : null;

  function handleScrape() {
    const body: { brand_id?: number; url?: string } = {};
    if (resolvedBrandId) body.brand_id = resolvedBrandId;
    if (url.trim()) body.url = url.trim();
    if (!body.brand_id && !body.url) return;
    scrapeNow.mutate(body, { onSuccess: (data) => setActiveJobId(data.jobId) });
  }

  function reset() {
    setActiveJobId(null);
    setUrl("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        Test the Website Sale Scraper pipeline end to end: discovery (if only a brand is picked), fetch, extraction,
        rule-based scoring, AI confirmation, dedup, and offer creation.
      </p>

      {activeJobId === null && (
        <Card>
          <CardHeader title="Test a Website Scrape" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <FieldGroup>
              <Label>Brand (optional — enables discovery + offer linking)</Label>
              <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">— none (ad-hoc URL only) —</option>
                {(brandsData?.brands ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup>
              <Label>Custom URL (optional — scrapes just this one page)</Label>
              <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://brand.com/sale" />
            </FieldGroup>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
            Brand only: discovers + scrapes up to a few relevant pages. URL only: scrapes just that page, no brand
            link. Both: scrapes just that URL, linked to the brand for offer creation.
          </p>
          <div>
            <Button loading={scrapeNow.isPending} disabled={!brandId && !url.trim()} onClick={handleScrape}>
              Scrape Now
            </Button>
          </div>
        </Card>
      )}

      {activeJobId !== null && isProcessing !== false && <ProcessingPanel jobId={activeJobId} onDismiss={reset} />}

      {activeJobId !== null && isProcessing === false && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {latestPage ? (
            <ScrapeDetailPanel page={latestPage} />
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No page result found for this run.</p>
          )}
          <div>
            <Button variant="secondary" onClick={reset}>Test another page</Button>
          </div>
        </div>
      )}
    </div>
  );
}
