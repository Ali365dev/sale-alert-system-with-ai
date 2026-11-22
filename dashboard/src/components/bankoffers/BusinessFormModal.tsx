import { useState, type FormEvent } from "react";

import type { ScrapedBusinessDetail } from "../../api/bankOffers";
import { useCreateBusiness, useUpdateBusiness } from "../../api/bankOfferAdmin";
import { Button } from "../ui/Button";
import { TextArea, TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { FormField } from "./OfferFormModal";
import "./bankOffers.css";

const TEXT_FIELDS = [
  { key: "category", label: "Category", placeholder: "e.g. Restaurant" },
  { key: "city", label: "City", placeholder: "e.g. Lahore" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "website", label: "Website", type: "url", placeholder: "https://" },
  { key: "logo_url", label: "Logo URL", type: "url", placeholder: "https://" },
  { key: "cover_image_url", label: "Cover image URL", type: "url", placeholder: "https://" },
] as const;

type TextKey = (typeof TEXT_FIELDS)[number]["key"] | "name" | "description";

export function BusinessFormModal({ business, onClose, onCreated }: {
  business?: ScrapedBusinessDetail;
  onClose: () => void;
  onCreated?: (id: number) => void;
}) {
  const create = useCreateBusiness();
  const update = useUpdateBusiness();
  const [nameError, setNameError] = useState<string>();
  const [active, setActive] = useState(business?.is_active ?? true);
  const [form, setForm] = useState<Record<TextKey, string>>({
    name: business?.name ?? "",
    category: business?.category ?? "",
    city: business?.city ?? "",
    phone: business?.phone ?? "",
    website: business?.website ?? "",
    logo_url: business?.logo_url ?? "",
    cover_image_url: business?.cover_image_url ?? "",
    description: business?.description ?? "",
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError("Business name is required.");
      return;
    }
    const input = { ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])), is_active: active };
    if (business) {
      update.mutate({ id: business.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: (d) => { onClose(); onCreated?.(d.id); } });
    }
  }

  return (
    <Modal
      title={business ? `Edit ${business.name}` : "Add business"}
      onClose={onClose}
      maxWidth={620}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="business-form" loading={create.isPending || update.isPending}>
            {business ? "Save changes" : "Create business"}
          </Button>
        </>
      }
    >
      <form id="business-form" onSubmit={submit} noValidate className="bo-form-grid">
        <FormField id="biz-name" label="Name" required error={nameError} span2>
          <TextInput id="biz-name" value={form.name} autoFocus aria-invalid={!!nameError}
            aria-describedby={nameError ? "biz-name-error" : undefined}
            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setNameError(undefined); }} />
        </FormField>
        {TEXT_FIELDS.map((f) => (
          <FormField key={f.key} id={`biz-${f.key}`} label={f.label}>
            <TextInput id={`biz-${f.key}`} type={"type" in f ? f.type : "text"}
              placeholder={"placeholder" in f ? f.placeholder : undefined} value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} />
          </FormField>
        ))}
        <FormField id="biz-description" label="Description" span2>
          <TextArea id="biz-description" rows={3} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </FormField>
        <label className="bo-check span-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active — business and its offers are visible to app users
        </label>
      </form>
    </Modal>
  );
}
