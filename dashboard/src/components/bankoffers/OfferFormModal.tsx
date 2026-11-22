import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useScrapedBusinesses, type BankOfferRow } from "../../api/bankOffers";
import { useCreateOffer, useUpdateOffer, type OfferInput } from "../../api/bankOfferAdmin";
import { Button } from "../ui/Button";
import { Label, Select, TextArea, TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { splitList, toDateInput } from "./format";
import "./bankOffers.css";

type Errors = Partial<Record<"business" | "bank" | "discount" | "maxAmount", string>>;

const ERROR_FIELD_IDS: Record<keyof Errors, string> = {
  business: "offer-business",
  bank: "offer-bank",
  discount: "offer-discount",
  maxAmount: "offer-max-amount",
};

export function FormField({ id, label, required, error, hint, span2, children }: {
  id: string; label: string; required?: boolean; error?: string; hint?: string; span2?: boolean; children: ReactNode;
}) {
  return (
    <div className={span2 ? "span-2" : undefined}>
      <Label htmlFor={id}>{label}{required && <span className="bo-required" aria-hidden="true">*</span>}</Label>
      {children}
      {error ? <p id={`${id}-error`} className="bo-field-error" role="alert">{error}</p>
        : hint ? <p className="bo-field-hint">{hint}</p> : null}
    </div>
  );
}

function BusinessPicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isFetching } = useScrapedBusinesses({ q: debounced || undefined, limit: 25 });

  return (
    <FormField id="offer-business" label="Business" required error={error} span2>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)", gap: 8 }}>
        <TextInput type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filter businesses…" aria-label="Filter businesses" />
        <Select id="offer-business" value={value} onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? "offer-business-error" : undefined}>
          <option value="">{isFetching ? "Loading…" : "Select a business"}</option>
          {(data?.businesses ?? []).map((b) => (
            <option key={b.id} value={b.id}>{b.name}{b.city ? ` · ${b.city}` : ""}</option>
          ))}
        </Select>
      </div>
    </FormField>
  );
}

export function OfferFormModal({ offer, businessId, bankNames, onClose }: {
  offer?: BankOfferRow;
  businessId?: number;
  bankNames: string[];
  onClose: () => void;
}) {
  const create = useCreateOffer();
  const update = useUpdateOffer();
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState({
    business: String(offer?.business_id ?? businessId ?? ""),
    bank_name: offer?.bank_name ?? "",
    bank_logo: offer?.bank_logo ?? "",
    card_name: offer?.card_name ?? "",
    discount: offer?.discount_percentage?.toString() ?? "",
    max_amount: offer?.max_discount_amount?.toString() ?? "",
    max_text: offer?.max_discount_text ?? "",
    expiry: toDateInput(offer?.expiry_date ?? null),
    valid_days: (offer?.valid_days ?? []).join(", "),
    terms: (offer?.terms ?? []).join("\n"),
    description: offer?.description ?? "",
    is_active: offer?.is_active ?? true,
  });
  const set = (key: keyof typeof form) => (value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  function validate(): Errors {
    const next: Errors = {};
    if (!form.business) next.business = "Choose the business this offer applies to.";
    if (!form.bank_name.trim()) next.bank = "Bank name is required.";
    const d = Number(form.discount);
    if (form.discount && (Number.isNaN(d) || d < 0 || d > 100)) next.discount = "Enter a percentage between 0 and 100.";
    if (form.max_amount && (Number.isNaN(Number(form.max_amount)) || Number(form.max_amount) < 0)) next.maxAmount = "Enter a positive amount.";
    return next;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    const firstInvalid = (Object.keys(next) as (keyof Errors)[])[0];
    if (firstInvalid) {
      document.getElementById(ERROR_FIELD_IDS[firstInvalid])?.focus();
      return;
    }
    const input: OfferInput = {
      business_id: Number(form.business),
      bank_name: form.bank_name.trim(),
      bank_logo: form.bank_logo || null,
      card_name: form.card_name || null,
      discount_percentage: form.discount ? Number(form.discount) : null,
      max_discount_amount: form.max_amount ? Number(form.max_amount) : null,
      max_discount_text: form.max_text || null,
      expiry_date: form.expiry || null,
      valid_days: splitList(form.valid_days, /,/),
      terms: splitList(form.terms, /\n/),
      description: form.description || null,
      is_active: form.is_active,
    };
    if (offer) update.mutate({ id: offer.id, input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  }

  const pending = create.isPending || update.isPending;

  return (
    <Modal
      title={offer ? `Edit offer · ${offer.place_name}` : "Add bank card offer"}
      onClose={onClose}
      maxWidth={680}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="offer-form" loading={pending}>{offer ? "Save changes" : "Add offer"}</Button>
        </>
      }
    >
      <form id="offer-form" onSubmit={submit} noValidate className="bo-form-grid">
        {!offer && !businessId && (
          <BusinessPicker value={form.business} onChange={set("business")} error={errors.business} />
        )}
        <FormField id="offer-bank" label="Bank" required error={errors.bank} hint="Pick an existing bank to keep names consistent.">
          <TextInput id="offer-bank" list="offer-bank-names" value={form.bank_name} autoFocus
            onChange={(e) => set("bank_name")(e.target.value)} aria-invalid={!!errors.bank}
            aria-describedby={errors.bank ? "offer-bank-error" : undefined} />
          <datalist id="offer-bank-names">{bankNames.map((b) => <option key={b} value={b} />)}</datalist>
        </FormField>
        <FormField id="offer-card" label="Card">
          <TextInput id="offer-card" value={form.card_name} placeholder="e.g. Platinum Credit"
            onChange={(e) => set("card_name")(e.target.value)} />
        </FormField>
        <FormField id="offer-discount" label="Discount %" error={errors.discount}>
          <TextInput id="offer-discount" type="number" inputMode="decimal" min={0} max={100} step="0.5"
            value={form.discount} onChange={(e) => set("discount")(e.target.value)} aria-invalid={!!errors.discount}
            aria-describedby={errors.discount ? "offer-discount-error" : undefined} />
        </FormField>
        <FormField id="offer-expiry" label="Expiry date" hint="Leave blank if the offer has no end date.">
          <TextInput id="offer-expiry" type="date" value={form.expiry} onChange={(e) => set("expiry")(e.target.value)} />
        </FormField>
        <FormField id="offer-max-amount" label="Max discount amount" error={errors.maxAmount}>
          <TextInput id="offer-max-amount" type="number" inputMode="numeric" min={0} value={form.max_amount}
            onChange={(e) => set("max_amount")(e.target.value)} aria-invalid={!!errors.maxAmount}
            aria-describedby={errors.maxAmount ? "offer-max-amount-error" : undefined} />
        </FormField>
        <FormField id="offer-max-text" label="Max discount label">
          <TextInput id="offer-max-text" value={form.max_text} placeholder="e.g. Up to Rs 2,000"
            onChange={(e) => set("max_text")(e.target.value)} />
        </FormField>
        <FormField id="offer-days" label="Valid days" hint="Comma separated, e.g. Mon, Tue">
          <TextInput id="offer-days" value={form.valid_days} onChange={(e) => set("valid_days")(e.target.value)} />
        </FormField>
        <FormField id="offer-logo" label="Bank logo URL">
          <TextInput id="offer-logo" type="url" value={form.bank_logo} onChange={(e) => set("bank_logo")(e.target.value)} />
        </FormField>
        <FormField id="offer-terms" label="Terms & conditions" hint="One per line." span2>
          <TextArea id="offer-terms" rows={3} value={form.terms} onChange={(e) => set("terms")(e.target.value)} />
        </FormField>
        <FormField id="offer-desc" label="Description" span2>
          <TextArea id="offer-desc" rows={2} value={form.description} onChange={(e) => set("description")(e.target.value)} />
        </FormField>
        <label className="bo-check span-2">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active")(e.target.checked)} />
          Active — visible to app users
        </label>
      </form>
    </Modal>
  );
}
