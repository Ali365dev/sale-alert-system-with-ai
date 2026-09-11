import { useState } from "react";

import { useBrands } from "../api/brands";
import { useJob } from "../api/jobs";
import { isHttpUrl, useScrapeNow, useWebsiteJobPages } from "../api/websiteScraper";
import { ScrapeDetailPanel } from "../components/websiteScraper/ScrapeDetailPanel";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FieldGroup, Label, Select, TextInput } from "../components/ui/Field";
import { LoadingState } from "../components/ui/Spinner";

/** Manual testing workflow (spec §18): pick a brand and/or paste a URL, run
 * the full pipeline once, and inspect every stage's result. Mirrors
 * SocialScraperTest.tsx's shape. */
export function WebsiteScraperTest() {
  const { data: brandsData, isError: brandsError, refetch: refetchBrands } = useBrands();
  const [brandId, setBrandId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);

  const scrapeNow = useScrapeNow();
  const { data: job } = useJob(activeJobId);
  const isProcessing = job && (job.status === "pending" || job.status === "running" || job.status === "cancelling");

  const resolvedBrandId = brandId ? Number(brandId) : null;
  const { data: pages, isLoading: pagesLoading, isError: pagesError, refetch: refetchPages } = useWebsiteJobPages(
    isProcessing === false ? activeJobId : null,
  );
  const selectedPage = pages?.find((p) => p.id === selectedPageId) ?? pages?.[0] ?? null;

  function handleScrape() {
    const trimmed = url.trim();
    if (trimmed && !isHttpUrl(trimmed)) {
      setUrlError("Enter a full http(s) URL, or leave this field empty and pick a brand.");
      return;
    }
    const body: { brand_id?: number; url?: string } = {};
    if (resolvedBrandId) body.brand_id = resolvedBrandId;
    if (trimmed) body.url = trimmed;
    if (!body.brand_id && !body.url) {
      setUrlError("Pick a brand or paste a website URL.");
      return;
    }
    setUrlError(null);
    scrapeNow.mutate(body, { onSuccess: (data) => { setActiveJobId(data.jobId); setSelectedPageId(null); } });
  }

  function reset() {
    setActiveJobId(null);
    setSelectedPageId(null);
    setUrl("");
    setUrlError(null);
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
          {brandsError && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--danger)" }}>Could not load brands. You can still paste a URL.</p>
              <Button size="sm" variant="ghost" onClick={() => refetchBrands()}>Retry brand list</Button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
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
              <TextInput
                value={url}
                onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
                placeholder="https://brand.com/sale"
                aria-invalid={!!urlError}
              />
            </FieldGroup>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
            Brand only: discovers + scrapes up to a few relevant pages. URL only: scrapes just that page, no brand
            link. Both: scrapes just that URL, linked to the brand for offer creation.
          </p>
          {urlError && <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>{urlError}</p>}
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
          {pagesLoading && <LoadingState label="Loading scrape results…" />}
          {pagesError && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--danger)" }}>Unable to load pages for this job.</p>
              <Button size="sm" variant="secondary" onClick={() => refetchPages()}>Try again</Button>
            </div>
          )}
          {!pagesLoading && !pagesError && (pages?.length ?? 0) > 1 && (
            <Card>
              <CardHeader title="Pages in this run" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pages!.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPageId(p.id)}
                    style={{
                      textAlign: "left",
                      border: "1px solid var(--border)",
                      background: selectedPage?.id === p.id ? "var(--surface-sunken)" : "transparent",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 10px",
                      cursor: "pointer",
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <Badge tone={p.scrape_status === "SALE_DETECTED" ? "success" : p.scrape_status === "ERROR" || p.scrape_status === "BLOCKED" ? "danger" : "neutral"}>
                      {p.scrape_status}
                    </Badge>
                    <span style={{ fontSize: 12.5, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.url}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
          {selectedPage ? (
            <ScrapeDetailPanel page={selectedPage} />
          ) : !pagesLoading && !pagesError ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              No page result found for this run. Discovery may have failed — check the job log above or try a direct page URL.
            </p>
          ) : null}
          <div>
            <Button variant="secondary" onClick={reset}>Test another page</Button>
          </div>
        </div>
      )}
    </div>
  );
}
