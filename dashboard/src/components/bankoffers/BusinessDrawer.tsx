import { useState } from "react";

import { useBrands } from "../../api/brands";
import {
  useCombinedOffers, useDeleteScrapedBusiness, useScrapedBusiness,
  useSetBusinessBrand, type BankOfferRow,
} from "../../api/bankOffers";
import { useBanks, useDeleteOffer, useUpdateOffer } from "../../api/bankOfferAdmin";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { Select } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { LoadingState } from "../ui/Spinner";
import { Icon } from "../icons";
import { BusinessFormModal } from "./BusinessFormModal";
import { OfferFormModal } from "./OfferFormModal";
import { fmtDate, isExpired } from "./format";
import "./bankOffers.css";

function BankGroup({ bank, rows, onEdit }: { bank: string; rows: BankOfferRow[]; onEdit: (o: BankOfferRow) => void }) {
  const deleteOffer = useDeleteOffer();
  const updateOffer = useUpdateOffer();
  const terms = rows[0]?.terms ?? [];
  return (
    <div className="bo-box">
      <div className="bo-box-head">
        <strong className="bo-strong">{bank}</strong>
        <Badge tone="brand">{rows.length} card{rows.length !== 1 ? "s" : ""}</Badge>
      </div>
      {rows.map((o) => {
        const expired = isExpired(o.expiry_date);
        return (
          <div key={o.id} className="bo-box-row" style={{ opacity: o.is_active ? 1 : 0.6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bo-truncate" style={{ maxWidth: "100%" }}>
                {o.card_name ?? "All cards"}
                {o.valid_days.length > 0 && <span className="bo-muted"> · {o.valid_days.join(", ")}</span>}
              </div>
              <div style={{ fontSize: "0.75rem" }} className={expired ? "bo-danger-text" : "bo-muted"}>
                {o.expiry_date ? `${expired ? "Expired" : "Valid until"} ${fmtDate(o.expiry_date)}` : "No expiry"}
                {o.max_discount_text && ` · max ${o.max_discount_text}`}
                {!o.is_active && " · inactive"}
              </div>
            </div>
            <span className="bo-discount">{o.discount_percentage != null ? `${o.discount_percentage}%` : "—"}</span>
            <div className="bo-row-actions">
              <IconButton icon={<Icon.edit size={14} />} label="Edit offer" onClick={() => onEdit(o)} />
              <IconButton icon={<Icon.power size={14} />} label={o.is_active ? "Deactivate" : "Activate"}
                onClick={() => updateOffer.mutate({ id: o.id, input: { is_active: !o.is_active } })} />
              <IconButton icon={<Icon.trash size={14} />} label="Delete offer" variant="danger"
                onClick={() => { if (window.confirm(`Delete the ${o.card_name ?? bank} offer?`)) deleteOffer.mutate(o.id); }} />
            </div>
          </div>
        );
      })}
      {terms.length > 0 && (
        <details style={{ borderTop: "1px solid var(--border)" }}>
          <summary style={{ padding: "8px 12px", cursor: "pointer", font: "600 0.75rem/1 var(--font-sans)", color: "var(--text-muted)" }}>
            Terms &amp; conditions ({terms.length})
          </summary>
          <ul style={{ margin: 0, padding: "0 12px 10px 26px" }}>
            {terms.map((t) => <li key={t} className="bo-muted" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{t}</li>)}
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
  const next = selected === "" ? null : Number(selected);

  return (
    <div className="bo-toolbar">
      {brandName ? <Badge tone="success">Matched: {brandName}</Badge> : <Badge tone="neutral">No brand match</Badge>}
      <Select aria-label="Link to brand" value={selected} onChange={(e) => setSelected(e.target.value)} style={{ maxWidth: 240 }}>
        <option value="">— no brand —</option>
        {(brandsData?.brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
      <Button size="sm" variant="secondary" loading={setBrand.isPending} disabled={next === brandId}
        onClick={() => setBrand.mutate({ id: businessId, brand_id: next })}>
        Apply
      </Button>
    </div>
  );
}

function CombinedSection({ brandId }: { brandId: number }) {
  const { data, isLoading } = useCombinedOffers(brandId);
  if (isLoading) return <LoadingState label="Loading brand offers…" />;
  if (!data) return null;
  return (
    <>
      <p className="bo-section-label">Brand sale offers ({data.sale_offers.length})</p>
      {data.sale_offers.length === 0 ? (
        <p className="bo-muted" style={{ margin: 0, fontSize: "0.8rem" }}>No email/website sale offers for this brand.</p>
      ) : (
        <div className="bo-box">
          {data.sale_offers.slice(0, 8).map((o) => (
            <div key={o.id} className="bo-box-row" style={{ justifyContent: "space-between" }}>
              <span className="bo-truncate">
                {o.title ?? o.offer_type ?? "Offer"}
                {o.coupon_code && <span style={{ color: "var(--brand)", marginLeft: 6 }}>{o.coupon_code}</span>}
              </span>
              <span className="bo-discount">{o.discount_percentage != null ? `${o.discount_percentage}%` : o.offer_value ?? ""}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function BusinessDrawer({ businessId, onClose }: { businessId: number; onClose: () => void }) {
  const { data: biz, isLoading } = useScrapedBusiness(businessId);
  const { data: banks } = useBanks();
  const deleteBusiness = useDeleteScrapedBusiness();
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [editingOffer, setEditingOffer] = useState<BankOfferRow | "new" | null>(null);

  const byBank = new Map<string, BankOfferRow[]>();
  for (const o of biz?.offers ?? []) byBank.set(o.bank_name, [...(byBank.get(o.bank_name) ?? []), o]);

  if (editingBusiness && biz) return <BusinessFormModal business={biz} onClose={() => setEditingBusiness(false)} />;
  if (editingOffer && biz) {
    return (
      <OfferFormModal
        offer={editingOffer === "new" ? undefined : editingOffer}
        businessId={biz.id}
        bankNames={(banks ?? []).map((b) => b.bank_name)}
        onClose={() => setEditingOffer(null)}
      />
    );
  }

  return (
    <Modal
      title={biz?.name ?? "Business"}
      onClose={onClose}
      maxWidth={680}
      footer={biz && (
        <>
          <Button variant="danger" size="sm" loading={deleteBusiness.isPending} style={{ marginRight: "auto" }}
            onClick={() => {
              if (window.confirm(`Delete ${biz.name} and its ${biz.offers.length} offers? This cannot be undone.`)) {
                deleteBusiness.mutate(biz.id, { onSuccess: onClose });
              }
            }}>
            <Icon.trash size={15} aria-hidden="true" /> Delete
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditingBusiness(true)}>
            <Icon.edit size={15} aria-hidden="true" /> Edit details
          </Button>
        </>
      )}
    >
      {isLoading || !biz ? <LoadingState label="Loading business…" /> : (
        <>
          <div className="bo-name-cell" style={{ flexWrap: "wrap" }}>
            {biz.logo_url && <img src={biz.logo_url} alt="" width={40} height={40} className="bo-logo" style={{ width: 40, height: 40 }} />}
            {biz.is_active ? <Badge tone="success">active</Badge> : <Badge tone="neutral">inactive</Badge>}
            {biz.category && <Badge tone="neutral">{biz.category}</Badge>}
            {biz.city && <Badge tone="neutral">{biz.city}</Badge>}
            {biz.rating != null && <Badge tone="warning">★ {biz.rating}</Badge>}
            {biz.source_url.startsWith("http") && (
              <a href={biz.source_url} target="_blank" rel="noreferrer" style={{ font: "600 0.8rem/1 var(--font-sans)" }}>
                Source ↗
              </a>
            )}
          </div>
          {biz.description && <p className="bo-muted" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>{biz.description}</p>}

          <p className="bo-section-label">Brand match</p>
          <BrandMatchRow businessId={biz.id} brandId={biz.brand_id} brandName={biz.brand_name} />
          {biz.brand_id != null && <CombinedSection brandId={biz.brand_id} />}

          <p className="bo-section-label">
            Bank card offers ({biz.offers.length})
            <Button size="sm" variant="secondary" onClick={() => setEditingOffer("new")}>
              <Icon.plus size={14} aria-hidden="true" /> Add offer
            </Button>
          </p>
          {biz.offers.length === 0 && <p className="bo-muted" style={{ margin: 0, fontSize: "0.8rem" }}>No offers for this business yet.</p>}
          {[...byBank.entries()].map(([bank, rows]) => (
            <BankGroup key={bank} bank={bank} rows={rows} onEdit={setEditingOffer} />
          ))}

          {biz.branches.length > 0 && (
            <>
              <p className="bo-section-label">Branches ({biz.branches.length})</p>
              <div className="bo-box">
                {biz.branches.map((b, i) => (
                  <div key={`${b.name}-${i}`} className="bo-box-row" style={{ display: "block" }}>
                    <div className="bo-strong" style={{ fontSize: "0.8rem" }}>{b.name}</div>
                    <div className="bo-muted" style={{ fontSize: "0.75rem" }}>{b.address}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
