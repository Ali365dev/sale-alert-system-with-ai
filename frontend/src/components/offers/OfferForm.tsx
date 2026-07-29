import { useState } from "react";

import type { Offer, OfferInput } from "../../api/offers";
import { Button } from "../ui/Button";
import { Label, Select, TextArea, TextInput } from "../ui/Field";

const OFFER_TYPES = ["Discount", "BOGO", "Free Shipping", "Flash Sale", "Bundle", "Loyalty", "Other"];

export function OfferForm({
  initial,
  requireEmailId,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Offer;
  requireEmailId?: boolean;
  onSubmit: (input: OfferInput & { email_id?: number }) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    email_id: initial?.email_id?.toString() ?? "",
    brand: initial?.brand ?? "",
    company: initial?.company ?? "",
    category: initial?.category ?? "",
    subcategory: initial?.subcategory ?? "",
    offer_type: initial?.offer_type ?? OFFER_TYPES[0],
    discount_percentage: initial?.discount_percentage?.toString() ?? "",
    coupon_code: initial?.coupon_code ?? "",
    expiry_date: initial?.expiry_date?.slice(0, 10) ?? "",
    offer_value: initial?.offer_value ?? "",
    website: initial?.website ?? "",
    is_active: initial?.is_active ?? true,
    summary: initial?.summary ?? "",
    key_highlights: initial?.key_highlights?.join("\n") ?? "",
    verification_status: initial?.verification_status ?? "",
  });

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = () => {
    onSubmit({
      email_id: requireEmailId ? Number(form.email_id) : undefined,
      brand: form.brand || null,
      company: form.company || null,
      category: form.category || null,
      subcategory: form.subcategory || null,
      offer_type: form.offer_type || null,
      discount_percentage: form.discount_percentage ? Number(form.discount_percentage) : null,
      coupon_code: form.coupon_code || null,
      expiry_date: form.expiry_date || null,
      offer_value: form.offer_value || null,
      website: form.website || null,
      is_active: form.is_active,
      summary: form.summary || null,
      key_highlights: form.key_highlights.split("\n").map((h) => h.trim()).filter(Boolean),
      ...(initial ? { verification_status: form.verification_status || null } : {}),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {requireEmailId && (
        <div>
          <Label>Email ID *</Label>
          <TextInput type="number" value={form.email_id} onChange={(e) => update({ email_id: e.target.value })} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <Label>Brand</Label>
          <TextInput value={form.brand} onChange={(e) => update({ brand: e.target.value })} />
        </div>
        <div>
          <Label>Company</Label>
          <TextInput value={form.company} onChange={(e) => update({ company: e.target.value })} />
        </div>
        <div>
          <Label>Category</Label>
          <TextInput value={form.category} onChange={(e) => update({ category: e.target.value })} />
        </div>
        <div>
          <Label>Subcategory</Label>
          <TextInput value={form.subcategory} onChange={(e) => update({ subcategory: e.target.value })} />
        </div>
        <div>
          <Label>Offer type</Label>
          <Select value={form.offer_type} onChange={(e) => update({ offer_type: e.target.value })}>
            {OFFER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Discount %</Label>
          <TextInput
            type="number"
            min={0}
            max={100}
            value={form.discount_percentage}
            onChange={(e) => update({ discount_percentage: e.target.value })}
          />
        </div>
        <div>
          <Label>Coupon code</Label>
          <TextInput value={form.coupon_code} onChange={(e) => update({ coupon_code: e.target.value })} />
        </div>
        <div>
          <Label>Expiry date</Label>
          <TextInput type="date" value={form.expiry_date} onChange={(e) => update({ expiry_date: e.target.value })} />
        </div>
        <div>
          <Label>Offer value</Label>
          <TextInput value={form.offer_value} onChange={(e) => update({ offer_value: e.target.value })} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 10, gap: 8 }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => update({ is_active: e.target.checked })}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontSize: 13, color: "var(--text-body)" }}>Active</span>
        </div>
        {initial && (
          <div>
            <Label>Verification status</Label>
            <Select value={form.verification_status} onChange={(e) => update({ verification_status: e.target.value })}>
              <option value="">Unverified</option>
              <option value="verified">Verified</option>
              <option value="suspicious">Suspicious</option>
              <option value="invalid">Invalid</option>
            </Select>
          </div>
        )}
      </div>
      <div>
        <Label>Website / offer URL</Label>
        <TextInput value={form.website} onChange={(e) => update({ website: e.target.value })} />
      </div>
      <div>
        <Label>Summary</Label>
        <TextArea value={form.summary} onChange={(e) => update({ summary: e.target.value })} />
      </div>
      <div>
        <Label>Key highlights (one per line)</Label>
        <TextArea value={form.key_highlights} onChange={(e) => update({ key_highlights: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={handleSubmit} loading={submitting}>
          {initial ? "Update offer" : "Save offer"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
