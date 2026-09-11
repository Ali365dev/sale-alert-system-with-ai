import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  useCloseOffer,
  useScrapeNow,
  useWebsiteBrandOffers,
  useWebsiteBrandsSummary,
  useWebsiteHistory,
  useWebsitePages,
  type WebsiteScrapedPage,
} from "../api/websiteScraper";
import { ScrapeDetailPanel } from "../components/websiteScraper/ScrapeDetailPanel";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { LoadingState } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "ai" | "brand"> = {
  NEW: "brand", UNCHANGED: "neutral", UPDATED: "warning", SALE_DETECTED: "success",
  NOT_SALE: "neutral", DUPLICATE: "neutral", ERROR: "danger", BLOCKED: "danger",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function PagesTable({ brandId }: { brandId: number }) {
  const { data: pages, isLoading, isError, refetch } = useWebsitePages(brandId);
  const [selected, setSelected] = useState<WebsiteScrapedPage | null>(null);

  if (isLoading) return <LoadingState label="Loading scraped pages…" />;
  if (isError) {
    return (
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--danger)" }}>Unable to load scraped pages for this brand.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }
  if (selected) return <ScrapeDetailPanel page={selected} onClose={() => setSelected(null)} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "8px 6px" }}>Page URL</th>
            <th style={{ padding: "8px 6px" }}>Title</th>
            <th style={{ padding: "8px 6px" }}>Status</th>
            <th style={{ padding: "8px 6px" }}>Sale Score</th>
            <th style={{ padding: "8px 6px" }}>AI</th>
            <th style={{ padding: "8px 6px" }}>Scraped At</th>
            <th style={{ padding: "8px 6px" }}></th>
          </tr>
        </thead>
        <tbody>
          {(pages ?? []).map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 6px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.url}>{p.url}</td>
              <td style={{ padding: "8px 6px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.page_title || "—"}</td>
              <td style={{ padding: "8px 6px" }}><Badge tone={STATUS_TONE[p.scrape_status] ?? "neutral"}>{p.scrape_status}</Badge></td>
              <td style={{ padding: "8px 6px" }}>{p.sale_score ?? "—"}</td>
              <td style={{ padding: "8px 6px" }}>{p.ai_analyzed ? "Yes" : "No"}</td>
              <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{formatDateTime(p.scraped_at)}</td>
              <td style={{ padding: "8px 6px" }}>
                <Button size="sm" variant="ghost" onClick={() => setSelected(p)}>View Details</Button>
              </td>
            </tr>
          ))}
          {(pages ?? []).length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>
                No pages stored yet. This brand has not produced scrape results — use Scrape now above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OffersTable({ brandId }: { brandId: number }) {
  const { data: offers, isLoading, isError, refetch } = useWebsiteBrandOffers(brandId);
  const closeOffer = useCloseOffer();
  const [closingId, setClosingId] = useState<number | null>(null);

  if (isLoading) return <LoadingState label="Loading website offers…" />;
  if (isError) {
    return (
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--danger)" }}>Unable to load website offers for this brand.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(offers ?? []).map((o) => (
        <Card key={o.id}>
          <CardHeader
            title={o.title || "(untitled offer)"}
            aside={<Badge tone={o.closure_status === "ACTIVE" ? "success" : o.closure_status === "POSSIBLY_ENDED" ? "warning" : "neutral"}>{o.closure_status ?? (o.is_active ? "ACTIVE" : "inactive")}</Badge>}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12.5 }}>
            {o.discount_percentage != null && <Badge tone="brand">{o.discount_percentage}% off</Badge>}
            {o.coupon_code && <Badge tone="ai">Code: {o.coupon_code}</Badge>}
            <span style={{ color: "var(--text-muted)" }}>missing count: {o.missing_count}</span>
          </div>
          {o.summary && <p style={{ margin: 0, fontSize: 12.5 }}>{o.summary}</p>}
          <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--text-muted)" }}>
            <span>First detected: {formatDateTime(o.first_seen_at)}</span>
            <span>Last verified: {formatDateTime(o.last_verified_at)}</span>
          </div>
          {o.source_url && <a href={o.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)" }}>{o.source_url}</a>}
          {o.closure_status !== "MANUALLY_CLOSED" && o.closure_status !== "EXPIRED" && (
            <div>
              {closingId === o.id ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>Close this offer? It will stop showing as active.</span>
                  <Button size="sm" variant="danger" loading={closeOffer.isPending} onClick={() => closeOffer.mutate(o.id, { onSettled: () => setClosingId(null) })}>
                    Confirm close
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setClosingId(null)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setClosingId(o.id)}>
                  Mark Closed
                </Button>
              )}
            </div>
          )}
        </Card>
      ))}
      {(offers ?? []).length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No website offers for this brand yet. Offers appear after a scrape finds a sale the AI confirms.
        </p>
      )}
    </div>
  );
}

export function WebsiteScraperBrand() {
  const { brandId } = useParams<{ brandId: string }>();
  const id = brandId && Number.isFinite(Number(brandId)) ? Number(brandId) : null;
  const navigate = useNavigate();
  const { data: brands, isLoading: brandsLoading, isError: brandsError, refetch: refetchBrands } = useWebsiteBrandsSummary();
  const { data: history, isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = useWebsiteHistory(id);
  const [tab, setTab] = useState("pages");
  const scrapeNow = useScrapeNow();
  const [jobId, setJobId] = useState<number | null>(null);

  const brand = brands?.find((b) => b.brand_id === id);

  if (!id) {
    return (
      <div>
        <p style={{ color: "var(--danger)", fontSize: 13 }}>This brand link is not valid.</p>
        <Button size="sm" variant="secondary" onClick={() => navigate("/website-scraper")}>Back to Website Scraper</Button>
      </div>
    );
  }

  if (brandsLoading) return <LoadingState label="Loading brand…" />;
  if (brandsError) {
    return (
      <div>
        <p style={{ color: "var(--danger)", fontSize: 13 }}>Unable to load this brand.</p>
        <Button size="sm" variant="secondary" onClick={() => refetchBrands()}>Try again</Button>
      </div>
    );
  }
  if (!brand) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          Brand #{id} is not in the website scraper list. It may have no website URL, or the id is wrong.
        </p>
        <Button size="sm" variant="secondary" onClick={() => navigate("/website-scraper")}>Back to Website Scraper</Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Button size="sm" variant="ghost" onClick={() => navigate("/website-scraper")}>← Website Scraper</Button>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, font: "800 20px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>{brand.brand_name}</h1>
          <a href={brand.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--brand)" }}>{brand.website}</a>
        </div>
        <Button
          loading={scrapeNow.isPending}
          disabled={!brand.scraping_enabled}
          onClick={() => scrapeNow.mutate({ brand_id: brand.brand_id }, { onSuccess: (data) => setJobId(data.jobId) })}
        >
          <Icon.play size={14} /> Scrape now
        </Button>
      </div>
      {!brand.scraping_enabled && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--warning)" }}>Scraping is disabled for this brand. Enable it from the Website Scraper list.</p>
      )}

      {jobId && <ProcessingPanel jobId={jobId} onDismiss={() => setJobId(null)} />}

      {historyError && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--danger)" }}>Unable to load scrape history.</p>
          <Button size="sm" variant="secondary" onClick={() => refetchHistory()}>Try again</Button>
        </div>
      )}

      <Card>
        <CardHeader title="Scrape History" />
        {historyLoading ? (
          <LoadingState label="Loading history…" />
        ) : history ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, fontSize: 12.5 }}>
            <div><span style={{ color: "var(--text-muted)" }}>Status: </span>{history.status}</div>
            <div><span style={{ color: "var(--text-muted)" }}>First scraped: </span>{formatDateTime(history.first_scraped_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last scraped: </span>{formatDateTime(history.last_scraped_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last successful: </span>{formatDateTime(history.last_successful_scrape_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last change: </span>{formatDateTime(history.last_content_change_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last sale detected: </span>{formatDateTime(history.last_detected_sale_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Total scrapes: </span>{history.total_scrape_count}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Pages last run: </span>{history.pages_discovered}</div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
            This brand has never been scraped. Use Scrape now to fetch sale pages from the website.
          </p>
        )}
        {history?.error_message && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>{history.error_message}</p>
        )}
      </Card>

      <Tabs tabs={[{ id: "pages", label: "Scraped Pages" }, { id: "offers", label: "Website Offers" }]} active={tab} onChange={setTab} />
      {tab === "pages" ? <PagesTable brandId={id} /> : <OffersTable brandId={id} />}
    </div>
  );
}
