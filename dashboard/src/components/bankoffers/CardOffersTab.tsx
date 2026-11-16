import { useState } from "react";
import { Link } from "react-router";

import { useListBankOffers, useScrapeBankOffers, type BankOfferRow } from "../../api/bankOffers";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { Select, TextInput } from "../ui/Field";
import { LoadingState } from "../ui/Spinner";
import { StatCard } from "../ui/StatCard";
import { Icon } from "../icons";
import { BusinessDrawer } from "./BusinessDrawer";
import "./CardOffersTab.css";

const PAGE_SIZE = 100;

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function isExpired(iso: string | null) {
  return iso ? new Date(iso) < new Date() : false;
}

const COLS = "minmax(160px,2fr) 130px minmax(130px,1.5fr) 70px 120px 90px 100px 110px";

function OfferRow({ offer, onOpenBusiness }: { offer: BankOfferRow; onOpenBusiness: (id: number) => void }) {
  const expired = isExpired(offer.expiry_date);
  const clickable = offer.business_id != null;

  return (
    <div
      className={`offer-row${clickable ? " offer-row--clickable" : ""}`}
      onClick={clickable ? () => onOpenBusiness(offer.business_id!) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBusiness(offer.business_id!); } } : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: COLS,
        alignItems: "center",
        gap: 12,
        padding: "9px 16px",
        borderBottom: "1px solid var(--border)",
        fontSize: 12.5,
      }}
    >
      <span
        className="offer-place-name"
        title={offer.place_name}
        style={{
          font: "600 12.5px/1.4 var(--font-sans)",
          color: "var(--text-strong)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {offer.place_name}
      </span>

      <span style={{ color: "var(--text-body)", fontWeight: 600 }}>{offer.bank_name}</span>

      <span
        title={offer.card_name ?? undefined}
        style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {offer.card_name ?? "—"}
      </span>

      <span style={{ font: "700 13px/1 var(--font-mono)", color: "var(--success)", textAlign: "right" }}>
        {offer.discount_percentage != null ? `${offer.discount_percentage}%` : "—"}
      </span>

      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {offer.max_discount_amount != null
          ? `Rs ${Number(offer.max_discount_amount).toLocaleString()}`
          : offer.max_discount_text ?? "—"}
      </span>

      <span
        title={offer.branch_valid_count != null && offer.valid_branches.length
          ? `Valid at ${offer.branch_valid_count} of ${offer.branch_total_count} branches:\n${offer.valid_branches.join("\n")}`
          : undefined}
        style={{
          font: "500 12px/1 var(--font-mono)",
          color: offer.branch_valid_count != null ? "var(--warning)" : "var(--text-faint)",
        }}
      >
        {offer.branch_valid_count != null ? `${offer.branch_valid_count}/${offer.branch_total_count}` : "All"}
      </span>

      <span style={{ font: "500 12px/1 var(--font-mono)", color: expired ? "var(--danger)" : "var(--text-muted)" }}>
        {fmt(offer.expiry_date)}
      </span>

      <span>
        {offer.brand_name
          ? <Badge tone="success">{offer.brand_name}</Badge>
          : <Badge tone="neutral">unmatched</Badge>}
      </span>
    </div>
  );
}

export function CardOffersTab({ onScrapeJobStart }: { onScrapeJobStart: (jobId: number) => void }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [openBusinessId, setOpenBusinessId] = useState<number | null>(null);

  const scrape = useScrapeBankOffers();

  const { data, isLoading } = useListBankOffers({
    q: search || undefined,
    bank_name: bankFilter || undefined,
    matched_only: matchedOnly || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const total = data?.total ?? 0;
  const offers = data?.offers ?? [];
  const bankNames = data?.bank_names ?? [];

  const hasFilters = !!search || !!bankFilter || matchedOnly;

  function clearFilters() {
    setQ("");
    setSearch("");
    setBankFilter("");
    setMatchedOnly(false);
    setOffset(0);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.offer size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total offers" value={total} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Brand matched" value={data?.matched_count ?? 0} valueColor="var(--success)" />
        <StatCard icon={<Icon.clock size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="With expiry" value={data?.with_expiry_count ?? 0} />
        <StatCard icon={<Icon.target size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="With max discount" value={data?.with_max_disc_count ?? 0} />
      </div>

      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <Icon.search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} />
            <form onSubmit={(e) => { e.preventDefault(); setOffset(0); setSearch(q.trim()); }}>
              <TextInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by place name…"
                aria-label="Search offers by place"
                style={{ paddingLeft: 32, height: 36 }}
              />
            </form>
          </div>

          <Select
            aria-label="Filter by bank"
            value={bankFilter}
            onChange={(e) => { setBankFilter(e.target.value); setOffset(0); }}
            style={{ width: 170 }}
          >
            <option value="">All Banks</option>
            {bankNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>

          <label style={{ display: "flex", gap: 6, alignItems: "center", font: "500 12px/1 var(--font-sans)", color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={matchedOnly} onChange={(e) => { setMatchedOnly(e.target.checked); setOffset(0); }} />
            Brand-matched only
          </label>

          {hasFilters && (
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Button
              size="sm"
              loading={scrape.isPending}
              onClick={() => scrape.mutate(undefined, { onSuccess: (d) => onScrapeJobStart(d.jobId) })}
            >
              Scrape takhfif.app
            </Button>
            <Link to="/pipeline" style={{ font: "500 12px/1 var(--font-sans)", color: "var(--brand)" }}>
              View jobs →
            </Link>
          </div>
        </div>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <CardHeader
          icon={<Icon.offer size={16} />}
          title={`Bank card offers${total ? ` (${total})` : ""}`}
        />
        {isLoading ? <LoadingState label="Loading offers…" /> : offers.length === 0 ? (
          <p style={{ padding: "28px 16px", textAlign: "center", font: "500 13px/1.5 var(--font-sans)", color: "var(--text-faint)", margin: 0 }}>
            {hasFilters ? "No offers match the current filters." : "No offers found. Trigger a scrape to populate."}
          </p>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--border)",
              font: "700 10.5px/1 var(--font-sans)", letterSpacing: "var(--ls-wide)",
              textTransform: "uppercase", color: "var(--text-faint)",
            }}>
              <span>Place</span>
              <span>Bank</span>
              <span>Card</span>
              <span style={{ textAlign: "right" }}>Disc %</span>
              <span>Max Discount</span>
              <span>Branches</span>
              <span>Expires</span>
              <span>Brand</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              {offers.map((o) => (
                <OfferRow key={o.id} offer={o} onOpenBusiness={setOpenBusinessId} />
              ))}
            </div>
            {total > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px", alignItems: "center" }}>
                <span style={{ font: "500 12px/1 var(--font-sans)", color: "var(--text-muted)" }}>
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                </span>
                <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
              </div>
            )}
          </>
        )}
      </Card>

      {openBusinessId != null && <BusinessDrawer businessId={openBusinessId} onClose={() => setOpenBusinessId(null)} />}
    </div>
  );
}
