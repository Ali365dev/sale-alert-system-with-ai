import { useState } from "react";

import { useBrands } from "../../api/brands";
import {
  useCombinedOffers, useDeleteScrapedBusiness, useScrapedBusiness,
  useSetBusinessBrand, type BankOfferRow,
} from "../../api/bankOffers";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { LoadingState } from "../ui/Spinner";

const label: React.CSSProperties = {
  font: "700 10.5px/1 var(--font-sans)", letterSpacing: "var(--ls-wide)",
  textTransform: "uppercase", color: "var(--text-faint)", margin: "14px 0 6px",
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function isExpired(iso: string | null) {
  return iso ? new Date(iso) < new Date() : false;
}

function BankGroup({ bank, rows }: { bank: string; rows: BankOfferRow[] }) {
  const terms = rows[0]?.terms ?? [];
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", marginBottom: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface-sunken)" }}>
        <strong style={{ font: "700 12.5px/1 var(--font-sans)", color: "var(--text-strong)" }}>{bank}</strong>
        <Badge tone="brand">{rows.length} card{rows.length !== 1 ? "s" : ""}</Badge>
      </div>
      {rows.map((o) => {
        const expired = isExpired(o.expiry_date);
        const dateStr = fmtDate(o.expiry_date);
        return (
          <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 10px", padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
            {/* Row 1: card name + discount */}
            <span style={{ font: "500 12px/1.4 var(--font-sans)", color: "var(--text-body)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {o.card_name ?? "All cards"}
              {o.valid_days.length > 0 && (
                <span style={{ color: "var(--text-faint)", marginLeft: 6 }}>({o.valid_days.join(", ")})</span>
              )}
            </span>
            <span style={{ font: "600 12px/1.4 var(--font-mono)", color: "var(--success)", whiteSpace: "nowrap", textAlign: "right" }}>
              {o.discount_percentage != null ? `${o.discount_percentage}%` : "—"}
              {o.max_discount_text && (
                <span style={{ color: "var(--text-faint)", fontWeight: 400, marginLeft: 5 }}>max {o.max_discount_text}</span>
              )}
            </span>
            {/* Row 2: expiry */}
            {dateStr && (
              <>
                <span style={{ font: "400 11px/1 var(--font-sans)", color: expired ? "var(--danger)" : "var(--text-faint)", gridColumn: "1 / -1" }}>
                  {expired ? "Expired" : "Valid until"} {dateStr}
                </span>
              </>
            )}
          </div>
        );
      })}
      {terms.length > 0 && (
        <details style={{ borderTop: "1px solid var(--border)" }}>
          <summary style={{ padding: "7px 12px", cursor: "pointer", font: "600 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}>
            Terms &amp; conditions ({terms.length})
          </summary>
          <ul style={{ margin: 0, padding: "0 12px 10px 26px" }}>
            {terms.map((t) => (
              <li key={t} style={{ font: "400 11.5px/1.5 var(--font-sans)", color: "var(--text-muted)" }}>{t}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BrandMatchRow({ businessId, brandId, brandName }: { businessId: number; brandId: number | null; brandName: string | null }) {
  const { data: brandsData } = useBrands();
  const setBrand = useSetBusinessBrand();
  const [selected, setSelected] = useState<string>(brandId != null ? String(brandId) : "");

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {brandName
        ? <Badge tone="success">Matched: {brandName}</Badge>
        : <Badge tone="neutral">No brand match</Badge>}
      <select
        aria-label="Link to brand"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          height: 30, padding: "0 8px", borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)", background: "var(--surface-card)",
          color: "var(--text-body)", font: "500 12px/1 var(--font-sans)", maxWidth: 220,
        }}
      >
        <option value="">— no brand —</option>
        {(brandsData?.brands ?? []).map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <Button
        size="sm" variant="secondary"
        loading={setBrand.isPending}
        disabled={(selected === "" ? null : Number(selected)) === brandId}
        onClick={() => setBrand.mutate({ id: businessId, brand_id: selected === "" ? null : Number(selected) })}
      >
        Apply
      </Button>
    </div>
  );
}

function CombinedSection({ brandId }: { brandId: number }) {
  const { data, isLoading } = useCombinedOffers(brandId);
  if (isLoading) return <LoadingState label="Loading combined offers…" />;
  if (!data) return null;
  return (
    <>
      <p style={label}>Brand sale offers ({data.sale_offers.length})</p>
      {data.sale_offers.length === 0 ? (
        <p style={{ font: "400 12px/1.4 var(--font-sans)", color: "var(--text-faint)", margin: 0 }}>
          No email/website sale offers for this brand.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          {data.sale_offers.slice(0, 8).map((o, i) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 12px", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <span style={{ font: "500 12px/1.4 var(--font-sans)", color: "var(--text-body)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.title ?? o.offer_type ?? "Offer"}
                {o.coupon_code && <span style={{ color: "var(--brand)", marginLeft: 6 }}>{o.coupon_code}</span>}
              </span>
              <span style={{ font: "600 12px/1.4 var(--font-mono)", color: "var(--success)", whiteSpace: "nowrap" }}>
                {o.discount_percentage != null ? `${o.discount_percentage}%` : o.offer_value ?? ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function BusinessDrawer({ businessId, onClose }: { businessId: number; onClose: () => void }) {
  const { data: biz, isLoading } = useScrapedBusiness(businessId);
  const deleteBusiness = useDeleteScrapedBusiness();

  const byBank = new Map<string, BankOfferRow[]>();
  for (const o of biz?.offers ?? []) {
    byBank.set(o.bank_name, [...(byBank.get(o.bank_name) ?? []), o]);
  }

  return (
    <Modal title={biz?.name ?? "Business"} onClose={onClose} maxWidth={640}>
      {isLoading || !biz ? <LoadingState label="Loading business…" /> : (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {biz.category && <Badge tone="neutral">{biz.category}</Badge>}
            {biz.city && <Badge tone="neutral">{biz.city}</Badge>}
            {biz.rating != null && <Badge tone="warning">★ {biz.rating}</Badge>}
            <a href={biz.source_url} target="_blank" rel="noreferrer"
              style={{ font: "600 12px/1 var(--font-sans)", color: "var(--brand)" }}>
              View on takhfif ↗
            </a>
          </div>

          <p style={label}>Brand match</p>
          <BrandMatchRow businessId={biz.id} brandId={biz.brand_id} brandName={biz.brand_name} />
          {biz.brand_id != null && <CombinedSection brandId={biz.brand_id} />}

          <p style={label}>Bank card offers ({biz.offers.length})</p>
          {[...byBank.entries()].map(([bank, rows]) => (
            <BankGroup key={bank} bank={bank} rows={rows} />
          ))}

          {biz.branches.length > 0 && (
            <>
              <p style={label}>Branches ({biz.branches.length})</p>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                {biz.branches.map((b, i) => (
                  <div key={b.name} style={{ padding: "7px 12px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                    <div style={{ font: "600 12px/1.4 var(--font-sans)", color: "var(--text-strong)" }}>{b.name}</div>
                    <div style={{ font: "400 11.5px/1.4 var(--font-sans)", color: "var(--text-muted)" }}>{b.address}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Button
              variant="danger" size="sm"
              loading={deleteBusiness.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${biz.name} and its ${biz.offers.length} offer rows?`)) {
                  deleteBusiness.mutate(biz.id, { onSuccess: onClose });
                }
              }}
            >
              Delete business
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
