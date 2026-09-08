import { useSaveOffer, type SocialPost } from "../../api/socialScraper";
import { Icon } from "../icons";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";

const KEYWORD_TONE = {
  eligible_for_analysis: "success",
  needs_review: "warning",
  not_sale_related: "neutral",
} as const;

const KEYWORD_LABEL = {
  eligible_for_analysis: "Eligible for analysis",
  needs_review: "Needs review",
  not_sale_related: "Not sale-related",
} as const;

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "var(--text-faint)" }}>—</span>;
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

/** Shared between OfferDiscovery.tsx and SocialScraperTest.tsx — the
 * extracted-content + keyword + AI-analysis + generated-offer-preview
 * review block, plus the always-available manual "Save as Offer" override.
 * Renders whatever the post currently has; a still-processing post just
 * shows fewer filled-in sections (the caller's ProcessingPanel handles the
 * "still running" state, this only renders once there's something to show). */
export function PostReviewPanel({ post }: { post: SocialPost }) {
  const saveOffer = useSaveOffer(post.id);
  const PlatformIcon = Icon[post.platform];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <CardHeader
          icon={<PlatformIcon size={17} />}
          title="Extracted Post"
          aside={<Badge tone={post.status === "failed" ? "danger" : "neutral"}>{post.status}</Badge>}
        />
        {post.error && <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>{post.error}</p>}
        <div style={{ display: "flex", gap: 16 }}>
          <div
            style={{
              width: 96, height: 96, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)",
              border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0,
            }}
          >
            {post.image_url ? (
              <img
                src={post.image_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Icon.image size={22} />
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-body)", whiteSpace: "pre-wrap" }}>
              {post.caption || <span style={{ color: "var(--text-faint)" }}>No caption</span>}
            </span>
            <a href={post.post_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)" }}>
              {post.post_url}
            </a>
          </div>
        </div>

        {post.ocr_text && (
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)" }}>
              OCR Text
            </span>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-body)", whiteSpace: "pre-wrap" }}>{post.ocr_text}</p>
          </div>
        )}
      </Card>

      {post.keyword_status && (
        <Card>
          <CardHeader title="Detected Sale Keywords" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={KEYWORD_TONE[post.keyword_status]}>{KEYWORD_LABEL[post.keyword_status]}</Badge>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>score {post.keyword_score}</span>
          </div>
          {post.keyword_reason && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{post.keyword_reason}</p>}
        </Card>
      )}

      {post.ai_result && (
        <Card>
          <CardHeader title="AI Offer Analysis" aside={<ConfidenceBar value={post.ai_result.confidence} />} />
          <Badge tone={post.ai_result.is_offer ? "success" : "neutral"}>{post.ai_result.is_offer ? "Genuine offer" : "Not an offer"}</Badge>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-body)" }}>{post.ai_result.reasoning}</p>
        </Card>
      )}

      {post.ai_result?.is_offer && (
        <Card>
          <CardHeader title="Generated Offer Preview" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>{post.ai_result.title}</span>
            {post.ai_result.description && <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>{post.ai_result.description}</span>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {post.ai_result.discount_percentage != null && <Badge tone="brand">{post.ai_result.discount_percentage}% off</Badge>}
              {post.ai_result.offer_type && <Badge tone="neutral">{post.ai_result.offer_type}</Badge>}
              {post.ai_result.coupon_code && <Badge tone="ai">Code: {post.ai_result.coupon_code}</Badge>}
              {post.ai_result.category && <Badge tone="neutral">{post.ai_result.category}</Badge>}
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {post.offer_id ? (
          <Badge tone="success">Saved as offer #{post.offer_id}</Badge>
        ) : (
          <Button
            loading={saveOffer.isPending}
            disabled={post.status !== "processed"}
            onClick={() => saveOffer.mutate()}
          >
            Save as Offer
          </Button>
        )}
      </div>
    </div>
  );
}
