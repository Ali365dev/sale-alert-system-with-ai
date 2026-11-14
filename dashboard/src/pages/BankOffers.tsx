import { useState } from "react";

import { useScrapedBusinesses } from "../api/bankOffers";
import { Icon } from "../components/icons";
import { BusinessDrawer } from "../components/bankoffers/BusinessDrawer";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { LoadingState } from "../components/ui/Spinner";

const PAGE_SIZE = 50;

const cell: React.CSSProperties = { font: "500 12.5px/1.4 var(--font-sans)", color: "var(--text-body)" };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function BankOffers() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading } = useScrapedBusinesses({
    q: search || undefined, matched_only: matchedOnly || undefined,
    limit: PAGE_SIZE, offset,
  });
  const total = data?.total ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <CardHeader
          icon={<Icon.offer size={18} />}
          title={`Bank Offers — scraped businesses${total ? ` (${total})` : ""}`}
          aside={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <form
                onSubmit={(e) => { e.preventDefault(); setOffset(0); setSearch(q.trim()); }}
                style={{ display: "flex", gap: 6 }}
              >
                <input
                  type="search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search businesses…" aria-label="Search businesses"
                  style={{
                    height: 32, padding: "0 10px", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)", background: "var(--surface-card)",
                    color: "var(--text-body)", font: "500 12.5px/1 var(--font-sans)", width: 190,
                  }}
                />
                <Button type="submit" size="sm" variant="secondary">Search</Button>
              </form>
              <label style={{ display: "flex", gap: 6, alignItems: "center", font: "500 12px/1 var(--font-sans)", color: "var(--text-muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={matchedOnly}
                  onChange={(e) => { setOffset(0); setMatchedOnly(e.target.checked); }} />
                Brand-matched only
              </label>
            </div>
          }
        />

        {isLoading ? <LoadingState label="Loading businesses…" /> : !data?.businesses.length ? (
          <p style={{ padding: "28px 16px", textAlign: "center", font: "500 13px/1.5 var(--font-sans)", color: "var(--text-faint)", margin: 0 }}>
            No scraped businesses yet — save them from the chrome extension's Bank Offers tab
            (scrape details, review, then "Save to backend").
          </p>
        ) : (
          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "minmax(180px,1.4fr) 110px 120px 90px 90px 1fr 130px",
              gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--border)",
              font: "700 10.5px/1 var(--font-sans)", letterSpacing: "var(--ls-wide)",
              textTransform: "uppercase", color: "var(--text-faint)",
            }}>
              <span>Business</span><span>City</span><span>Category</span>
              <span>Banks</span><span>Cards</span><span>Brand match</span><span>Last scraped</span>
            </div>
            {data.businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => setOpenId(b.id)}
                aria-label={`Open ${b.name}`}
                style={{
                  display: "grid", gridTemplateColumns: "minmax(180px,1.4fr) 110px 120px 90px 90px 1fr 130px",
                  gap: 12, alignItems: "center", width: "100%", textAlign: "left",
                  padding: "10px 16px", border: 0, borderBottom: "1px solid var(--border)",
                  background: "transparent", cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {b.logo_url
                    ? <img src={b.logo_url} alt="" width={28} height={28}
                        style={{ borderRadius: 8, objectFit: "cover", background: "var(--surface-sunken)", flexShrink: 0 }} />
                    : <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-sunken)", flexShrink: 0 }} />}
                  <span style={{ ...cell, fontWeight: 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.name}{b.rating != null && <span style={{ color: "var(--amber-600)", marginLeft: 6 }}>★ {b.rating}</span>}
                  </span>
                </span>
                <span style={cell}>{b.city ?? "—"}</span>
                <span style={cell}>{b.category ?? "—"}</span>
                <span style={cell}>{b.banks_count}</span>
                <span style={cell}>{b.offers_count}</span>
                <span>{b.brand_name ? <Badge tone="success">{b.brand_name}</Badge> : <Badge tone="neutral">unmatched</Badge>}</span>
                <span style={{ ...cell, color: "var(--text-muted)" }}>{formatDate(b.last_scraped_at)}</span>
              </button>
            ))}
            {total > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px", alignItems: "center" }}>
                <span style={{ font: "500 12px/1 var(--font-sans)", color: "var(--text-muted)" }}>
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                </span>
                <Button size="sm" variant="secondary" disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {openId != null && <BusinessDrawer businessId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
