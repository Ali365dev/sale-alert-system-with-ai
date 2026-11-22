import { useId, useState, type FormEvent } from "react";

import {
  useBanks, useDeleteBank, useDeleteCard, useUpdateBank, useUpdateCard, type BankSummary,
} from "../../api/bankOfferAdmin";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Icon } from "../icons";
import { FormField } from "./OfferFormModal";
import type { OfferFilters } from "./CardOffersTab";
import "./bankOffers.css";

type EditTarget =
  | { kind: "bank"; bank: BankSummary }
  | { kind: "card"; bankName: string; cardName: string | null };

function EditModal({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  const updateBank = useUpdateBank();
  const updateCard = useUpdateCard();
  const isBank = target.kind === "bank";
  const [name, setName] = useState(isBank ? target.bank.bank_name : target.cardName ?? "");
  const [logo, setLogo] = useState(isBank ? target.bank.bank_logo ?? "" : "");
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (isBank) {
      if (!name.trim()) { setError("Bank name is required."); return; }
      updateBank.mutate({ bankName: target.bank.bank_name, input: { new_name: name.trim(), bank_logo: logo.trim() || null } }, { onSuccess: onClose });
    } else {
      updateCard.mutate({ bankName: target.bankName, cardName: target.cardName, input: { new_card_name: name.trim() || null } }, { onSuccess: onClose });
    }
  }

  return (
    <Modal
      title={isBank ? `Edit ${target.bank.bank_name}` : `Rename card · ${target.bankName}`}
      onClose={onClose}
      maxWidth={460}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="bank-edit-form" loading={updateBank.isPending || updateCard.isPending}>Save</Button>
        </>
      }
    >
      <form id="bank-edit-form" onSubmit={submit} noValidate className="bo-stack">
        <FormField id="edit-name" label={isBank ? "Bank name" : "Card name"} required={isBank} error={error}
          hint={isBank ? "Renaming merges into an existing bank with the same name." : "Leave blank to mean “all cards”."}>
          <TextInput id="edit-name" value={name} autoFocus onChange={(e) => { setName(e.target.value); setError(undefined); }}
            aria-invalid={!!error} aria-describedby={error ? "edit-name-error" : undefined} />
        </FormField>
        {isBank && (
          <FormField id="edit-logo" label="Logo URL" hint="Applied to every offer from this bank.">
            <TextInput id="edit-logo" type="url" value={logo} onChange={(e) => setLogo(e.target.value)} />
          </FormField>
        )}
      </form>
    </Modal>
  );
}

function BankCard({ bank, onEdit, onViewOffers }: {
  bank: BankSummary;
  onEdit: (t: EditTarget) => void;
  onViewOffers: (f: OfferFilters) => void;
}) {
  const updateBank = useUpdateBank();
  const deleteBank = useDeleteBank();
  const deleteCard = useDeleteCard();
  const allActive = bank.active_count === bank.offers_count;
  const headingId = useId();

  return (
    <article className="bo-bank-card" aria-labelledby={headingId}>
      <div className="bo-bank-head">
        {bank.bank_logo
          ? <img src={bank.bank_logo} alt="" width={40} height={40} className="bo-logo" style={{ width: 40, height: 40 }} loading="lazy" />
          : <span className="bo-logo" style={{ width: 40, height: 40 }} aria-hidden="true"><Icon.bank size={20} /></span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 id={headingId} className="bo-bank-name">{bank.bank_name}</h3>
          <div className="bo-bank-meta">
            {bank.max_discount != null && <Badge tone="success">up to {bank.max_discount}%</Badge>}
            {!allActive && <Badge tone="neutral">{bank.offers_count - bank.active_count} inactive</Badge>}
            {bank.expired_count > 0 && <Badge tone="danger">{bank.expired_count} expired</Badge>}
          </div>
        </div>
        <IconButton icon={<Icon.edit size={15} />} label="Edit bank" onClick={() => onEdit({ kind: "bank", bank })} />
      </div>

      <div className="bo-bank-stats">
        <div className="bo-bank-stat"><b>{bank.offers_count}</b><span>Offers</span></div>
        <div className="bo-bank-stat"><b>{bank.cards.length}</b><span>Cards</span></div>
        <div className="bo-bank-stat"><b>{bank.businesses_count}</b><span>Businesses</span></div>
      </div>

      <ul className="bo-card-list" aria-label={`${bank.bank_name} cards`}>
        {bank.cards.map((c) => (
          <li key={c.card_name ?? "__all"} className="bo-card-item">
            <Icon.card size={15} aria-hidden="true" style={{ color: "var(--text-faint)", flexShrink: 0 }} />
            <span className="bo-card-name" title={c.card_name ?? undefined}>{c.card_name ?? <em className="bo-muted">All cards</em>}</span>
            <span className="bo-muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{c.offers_count} offers</span>
            {c.max_discount != null && <span className="bo-discount" style={{ fontSize: "0.8rem" }}>{c.max_discount}%</span>}
            <div className="bo-row-actions">
              {c.card_name && (
                <IconButton icon={<Icon.list size={14} />} label="View offers for this card"
                  onClick={() => onViewOffers({ bank: bank.bank_name, card: c.card_name! })} />
              )}
              <IconButton icon={<Icon.edit size={14} />} label="Rename card"
                onClick={() => onEdit({ kind: "card", bankName: bank.bank_name, cardName: c.card_name })} />
              <IconButton icon={<Icon.trash size={14} />} label="Delete card offers" variant="danger"
                onClick={() => {
                  if (window.confirm(`Delete all ${c.offers_count} offers for ${c.card_name ?? "all cards"} (${bank.bank_name})?`)) {
                    deleteCard.mutate({ bankName: bank.bank_name, cardName: c.card_name });
                  }
                }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="bo-bank-foot">
        <Button size="sm" variant="secondary" onClick={() => onViewOffers({ bank: bank.bank_name })}>View offers</Button>
        <Button size="sm" variant="ghost" loading={updateBank.isPending}
          onClick={() => updateBank.mutate({ bankName: bank.bank_name, input: { is_active: !allActive } })}>
          {allActive ? "Deactivate all" : "Activate all"}
        </Button>
        <IconButton icon={<Icon.trash size={15} />} label="Delete bank" variant="danger" style={{ marginLeft: "auto" }}
          loading={deleteBank.isPending}
          onClick={() => {
            if (window.confirm(`Delete ${bank.bank_name} and all ${bank.offers_count} of its offers? This cannot be undone.`)) {
              deleteBank.mutate(bank.bank_name);
            }
          }} />
      </div>
    </article>
  );
}

export function BanksTab({ onViewOffers }: { onViewOffers: (f: OfferFilters) => void }) {
  const { data: banks, isLoading } = useBanks();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const term = q.trim().toLowerCase();
  const visible = (banks ?? []).filter((b) =>
    !term || b.bank_name.toLowerCase().includes(term) || b.cards.some((c) => c.card_name?.toLowerCase().includes(term)));

  return (
    <div className="bo-stack">
      <div className="bo-toolbar">
        <div className="bo-search" style={{ maxWidth: 360 }}>
          <Icon.search size={15} className="bo-search-icon" aria-hidden="true" />
          <TextInput type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search banks or cards…" aria-label="Search banks or cards" style={{ paddingLeft: 36 }} />
        </div>
        <span className="bo-muted" style={{ fontSize: "0.8rem" }} aria-live="polite">
          {banks ? `${visible.length} of ${banks.length} banks` : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="bo-bank-grid" aria-busy="true" aria-label="Loading banks">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-shimmer" style={{ height: 260, borderRadius: "var(--radius-lg)" }} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bo-empty">
          <span className="bo-empty-icon"><Icon.bank size={24} aria-hidden="true" /></span>
          <strong>{term ? "No banks match" : "No banks yet"}</strong>
          <span>Banks appear automatically once offers are added or scraped.</span>
        </div>
      ) : (
        <div className="bo-bank-grid">
          {visible.map((b) => <BankCard key={b.bank_name} bank={b} onEdit={setEditing} onViewOffers={onViewOffers} />)}
        </div>
      )}

      {editing && <EditModal target={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
