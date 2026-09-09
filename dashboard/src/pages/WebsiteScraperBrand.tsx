import { useState } from "react";
import { useParams } from "react-router";

import {
  useCloseOffer,
  useWebsiteBrandOffers,
  useWebsiteHistory,
  useWebsitePages,
  type WebsiteScrapedPage,
} from "../api/websiteScraper";
import { ScrapeDetailPanel } from "../components/websiteScraper/ScrapeDetailPanel";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { LoadingState } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "ai" | "brand"> = {
  NEW: "brand", UNCHANGED: "neutral", UPDATED: "warning", SALE_DETECTED: "success",
  NOT_SALE: "neutral", DUPLICATE: "neutral", ERROR: "danger", BLOCKED: "danger",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function PagesTable({ brandId }: { brandId: number }) {
  const { data: pages, isLoading } = useWebsitePages(brandId);
  const [selected, setSelected] = useState<WebsiteScrapedPage | null>(null);

  if (isLoading) return <LoadingState />;
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
              <td style={{ padding: "8px 6px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.url}</td>
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
            <tr><td colSpan={7} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>No scrapes yet — use Scrape Now from the dashboard.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OffersTable({ brandId }: { brandId: number }) {
  const { data: offers, isLoading } = useWebsiteBrandOffers(brandId);
  const closeOffer = useCloseOffer();

  if (isLoading) return <LoadingState />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(offers ?? []).map((o) => (
        <Card key={o.id}>
          <CardHeader
            title={o.title || "(untitled offer)"}
            aside={<Badge tone={o.closure_status === "ACTIVE" ? "success" : o.closure_status === "POSSIBLY_ENDED" ? "warning" : "neutral"}>{o.closure_status}</Badge>}
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
              <Button size="sm" variant="danger" loading={closeOffer.isPending} onClick={() => closeOffer.mutate(o.id)}>
                Mark Closed
              </Button>
            </div>
          )}
        </Card>
      ))}
      {(offers ?? []).length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No offers created from this brand's website yet.</p>}
    </div>
  );
}

export function WebsiteScraperBrand() {
  const { brandId } = useParams<{ brandId: string }>();
  const id = brandId ? Number(brandId) : null;
  const { data: history } = useWebsiteHistory(id);
  const [tab, setTab] = useState("pages");

  if (!id) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {history && (
        <Card>
          <CardHeader title="Scrape History" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, fontSize: 12.5 }}>
            <div><span style={{ color: "var(--text-muted)" }}>First scraped: </span>{formatDateTime(history.first_scraped_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last scraped: </span>{formatDateTime(history.last_scraped_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last successful: </span>{formatDateTime(history.last_successful_scrape_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last change: </span>{formatDateTime(history.last_content_change_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Last sale detected: </span>{formatDateTime(history.last_detected_sale_at)}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Total scrapes: </span>{history.total_scrape_count}</div>
          </div>
        </Card>
      )}

      <Tabs tabs={[{ id: "pages", label: "Scraped Pages" }, { id: "offers", label: "Active Offers" }]} active={tab} onChange={setTab} />
      {tab === "pages" ? <PagesTable brandId={id} /> : <OffersTable brandId={id} />}
    </div>
  );
}
