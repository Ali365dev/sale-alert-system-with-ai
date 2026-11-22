import type { BankOfferRow } from "../../api/bankOffers";
import { Badge } from "../ui/Badge";
import { IconButton } from "../ui/Button";
import { Icon } from "../icons";
import { fmtDate, fmtMoney, isExpired } from "./format";

export function OffersTable({
  offers, selected, onSelect, onSelectAll, onEdit, onDelete, onToggleActive, onOpenBusiness,
}: {
  offers: BankOfferRow[];
  selected: Set<number>;
  onSelect: (id: number) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (offer: BankOfferRow) => void;
  onDelete: (offer: BankOfferRow) => void;
  onToggleActive: (offer: BankOfferRow) => void;
  onOpenBusiness: (id: number) => void;
}) {
  const allSelected = offers.length > 0 && offers.every((o) => selected.has(o.id));

  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <caption className="sr-only">Bank card offers</caption>
        <thead>
          <tr>
            <th className="bo-cell-check">
              <input type="checkbox" aria-label="Select all offers on this page" checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)} />
            </th>
            <th scope="col">Business</th>
            <th scope="col">Bank</th>
            <th scope="col">Card</th>
            <th scope="col" className="num">Discount</th>
            <th scope="col">Max discount</th>
            <th scope="col">Branches</th>
            <th scope="col">Expires</th>
            <th scope="col">Status</th>
            <th scope="col" className="bo-cell-actions"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => {
            const expired = isExpired(o.expiry_date);
            const isSelected = selected.has(o.id);
            return (
              <tr key={o.id} className={[isSelected && "is-selected", !o.is_active && "is-inactive"].filter(Boolean).join(" ")}>
                <td className="bo-cell-check">
                  <input type="checkbox" checked={isSelected} onChange={() => onSelect(o.id)}
                    aria-label={`Select ${o.bank_name} offer at ${o.place_name}`} />
                </td>
                <td>
                  {o.business_id != null ? (
                    <button type="button" className="bo-link-btn bo-truncate" title={o.place_name}
                      onClick={() => onOpenBusiness(o.business_id!)}>
                      {o.place_name}
                    </button>
                  ) : <span className="bo-strong bo-truncate" title={o.place_name}>{o.place_name}</span>}
                  {o.brand_name && <span className="bo-muted" style={{ fontSize: "0.75rem" }}>↳ {o.brand_name}</span>}
                </td>
                <td className="bo-strong bo-nowrap">{o.bank_name}</td>
                <td><span className="bo-truncate bo-muted" title={o.card_name ?? undefined}>{o.card_name ?? "All cards"}</span></td>
                <td className="num"><span className="bo-discount">{o.discount_percentage != null ? `${o.discount_percentage}%` : "—"}</span></td>
                <td className="bo-muted">{fmtMoney(o.max_discount_amount, o.currency) ?? o.max_discount_text ?? "—"}</td>
                <td
                  className="bo-muted"
                  title={o.valid_branches.length ? o.valid_branches.join("\n") : undefined}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {o.branch_valid_count != null ? `${o.branch_valid_count}/${o.branch_total_count}` : "All"}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }} className={expired ? "bo-danger-text" : "bo-muted"}>
                  {fmtDate(o.expiry_date)}
                </td>
                <td>
                  {expired ? <Badge tone="danger">expired</Badge>
                    : o.is_active ? <Badge tone="success">active</Badge>
                    : <Badge tone="neutral">inactive</Badge>}
                </td>
                <td className="bo-cell-actions">
                  <div className="bo-row-actions">
                    <IconButton icon={<Icon.edit size={15} />} label="Edit offer" onClick={() => onEdit(o)} />
                    <IconButton icon={<Icon.power size={15} />} label={o.is_active ? "Deactivate" : "Activate"}
                      onClick={() => onToggleActive(o)} />
                    <IconButton icon={<Icon.trash size={15} />} label="Delete offer" variant="danger" onClick={() => onDelete(o)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
