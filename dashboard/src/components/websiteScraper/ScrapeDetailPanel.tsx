import { useReanalyzePage, useReprocessPage, type WebsiteScrapedPage } from "../../api/websiteScraper";
import { Icon } from "../icons";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "ai" | "brand"> = {
  NEW: "brand",
  UNCHANGED: "neutral",
  UPDATED: "warning",
  SALE_DETECTED: "success",
  NOT_SALE: "neutral",
  DUPLICATE: "neutral",
  ERROR: "danger",
  BLOCKED: "danger",
};

function ConfidenceBar({ value }: { value: number | null | undefined }) {
  if (value == null) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--amber-600)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 44, height: 6, borderRadius: 999, background: "var(--surface-sunken)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <span style={{ font: "600 11.5px/1 var(--font-mono)", color }}>{pct}%</span>
    </div>
  );
}

/** Scrape-detail view (spec §12) — Page Info / Extracted Content / Processing
 * Info, shared by the brand-detail table's row expansion and the manual test
 * page's result. Mirrors PostReviewPanel.tsx's multi-card layout. */
export function ScrapeDetailPanel({ page, onClose }: { page: WebsiteScrapedPage; onClose?: () => void }) {
  const reprocess = useReprocessPage();
  const reanalyze = useReanalyzePage();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <CardHeader
          icon={<Icon.globe size={17} />}
          title="Page Information"
          aside={<Badge tone={STATUS_TONE[page.scrape_status] ?? "neutral"}>{page.scrape_status}</Badge>}
        />
        {page.error_message && <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>{page.error_message}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>URL: </span>
            <a href={page.url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>{page.url}</a>
          </div>
          {page.final_url && page.final_url !== page.url && (
            <div><span style={{ color: "var(--text-muted)" }}>Final URL: </span>{page.final_url}</div>
          )}
          <div><span style={{ color: "var(--text-muted)" }}>Title: </span>{page.page_title || "—"}</div>
          <div><span style={{ color: "var(--text-muted)" }}>HTTP status: </span>{page.http_status ?? "—"}</div>
          <div><span style={{ color: "var(--text-muted)" }}>Scraped: </span>{page.scraped_at ? new Date(page.scraped_at).toLocaleString() : "—"}</div>
          <div><span style={{ color: "var(--text-muted)" }}>Content hash: </span><code style={{ fontSize: 11 }}>{page.normalized_content_hash?.slice(0, 12) ?? "—"}</code></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="secondary" loading={reprocess.isPending} onClick={() => reprocess.mutate(page.id)}>
            Reprocess (refetch)
          </Button>
          <Button size="sm" variant="ghost" loading={reanalyze.isPending} disabled={!page.body_text && !page.headline_text} onClick={() => reanalyze.mutate(page.id)}>
            Reanalyze (AI only)
          </Button>
          {onClose && <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Extracted Content" />
        {page.important_text.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {page.important_text.map((s, i) => <Badge key={i} tone="warning">{s}</Badge>)}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {page.discount_percentages.map((d, i) => <Badge key={i} tone="success">{d}% off</Badge>)}
          {page.coupon_codes.map((c, i) => <Badge key={i} tone="ai">Code: {c}</Badge>)}
        </div>
        {page.detected_prices.length > 0 && (
          <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>
            {page.detected_prices.slice(0, 8).map((p, i) => (
              <div key={i}>
                {p.original != null ? <span style={{ textDecoration: "line-through", color: "var(--text-muted)" }}>{p.original}</span> : null}{" "}
                {p.current}
              </div>
            ))}
          </div>
        )}
        {page.headline_text && (
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)" }}>Headlines</span>
            <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>{page.headline_text}</p>
          </div>
        )}
        {page.images.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {page.images.slice(0, 6).map((src, i) => (
              <img key={i} src={src} alt={page.image_alt_text[i] || `Image ${i + 1} from scraped page`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ))}
          </div>
        )}
      </Card>

      {page.sale_score != null && (
        <Card>
          <CardHeader title="Processing" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Rule-based sale score</span>
            <span style={{ font: "600 14px/1 var(--font-mono)", color: "var(--text-strong)" }}>{page.sale_score}/100</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>AI analyzed:</span>
            <Badge tone={page.ai_analyzed ? "success" : "neutral"}>{page.ai_analyzed ? "Yes" : "No — rule score skipped it"}</Badge>
          </div>
        </Card>
      )}

      {page.ai_result && (
        <Card>
          <CardHeader title="AI Offer Analysis" aside={<ConfidenceBar value={page.ai_result.confidence} />} />
          <Badge tone={page.ai_result.is_offer ? "success" : "neutral"}>{page.ai_result.is_offer ? "Genuine offer" : "Not an offer"}</Badge>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-body)" }}>{page.ai_result.reasoning}</p>
          {page.ai_result.is_offer && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <span style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>{page.ai_result.title}</span>
              {page.ai_result.description && <span style={{ fontSize: 12.5 }}>{page.ai_result.description}</span>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {page.ai_result.discount_percentage != null && <Badge tone="brand">{page.ai_result.discount_percentage}% off</Badge>}
                {page.ai_result.offer_type && <Badge tone="neutral">{page.ai_result.offer_type}</Badge>}
                {page.ai_result.coupon_code && <Badge tone="ai">Code: {page.ai_result.coupon_code}</Badge>}
              </div>
            </div>
          )}
        </Card>
      )}

      <div>
        {page.offer_id ? (
          <Badge tone="success">Offer #{page.offer_id} {page.scrape_status === "UNCHANGED" ? "(unchanged — updated)" : "created/updated"}</Badge>
        ) : (
          <Badge tone="neutral">No offer created for this scrape</Badge>
        )}
      </div>
    </div>
  );
}
