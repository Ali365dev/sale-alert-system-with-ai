import { useState } from "react";
import type { ScrapedOffer } from "../../types";
import { Tooltip } from "./Tooltip";

interface Props {
  offer: ScrapedOffer;
  selected: boolean;
  onToggle: () => void;
  onChange: (updated: ScrapedOffer) => void;
}

export function OfferCard({ offer, selected, onToggle, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ScrapedOffer>(offer);

  const handleSave = () => {
    onChange(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(offer);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border border-primary/30 rounded-xl bg-white p-3 shadow-sm">
        <p className="text-xs font-bold text-primary mb-2">Edit Offer</p>
        <div className="flex flex-col gap-2">
          {([
            ["title", "Title"],
            ["brand", "Brand"],
            ["category", "Category"],
            ["coupon_code", "Coupon Code"],
          ] as [keyof ScrapedOffer, string][]).map(([field, label]) => (
            <div key={field}>
              <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
              <input
                type="text"
                value={(draft[field] as string) ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value || undefined }))}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            {([
              ["discount_percentage", "Discount %"],
              ["sale_price", "Sale Price"],
            ] as [keyof ScrapedOffer, string][]).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                <input
                  type="number"
                  value={(draft[field] as number) ?? ""}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Expiry Date</label>
            <input
              type="date"
              value={draft.expiry_date ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, expiry_date: e.target.value || undefined }))}
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSave} className="flex-1 py-1.5 bg-primary text-white text-xs font-bold rounded-lg">Save</button>
          <button onClick={handleCancel} className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
        selected ? "border-primary/40 bg-primary/5" : "border-gray-100 bg-white hover:border-gray-200"
      }`}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
          selected ? "border-primary bg-primary" : "border-gray-300"
        }`}>
          {selected && <span className="text-white text-[9px] font-bold">✓</span>}
        </div>
      </div>

      {/* Image */}
      {offer.image_url && (
        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={offer.image_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-dark truncate leading-tight">{offer.title}</p>
        {offer.brand && (
          <p className="text-[10px] text-gray-400 truncate">{offer.brand}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {offer.discount_percentage && (
            <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-md">
              {offer.discount_percentage}% OFF
            </span>
          )}
          {offer.coupon_code && (
            <span className="px-1.5 py-0.5 bg-accent text-dark text-[10px] font-bold rounded-md font-mono">
              {offer.coupon_code}
            </span>
          )}
          {offer.original_price && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-[10px] rounded-md line-through">
              {offer.currency ?? ""}{offer.original_price}
            </span>
          )}
          {offer.sale_price && (
            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-semibold rounded-md">
              {offer.currency ?? ""}{offer.sale_price}
            </span>
          )}
          {offer.expiry_date && (
            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[10px] rounded-md">
              Exp {offer.expiry_date.slice(0, 10)}
            </span>
          )}
        </div>
        {offer.source_url && (
          <p className="text-[9px] text-gray-300 truncate mt-0.5 font-mono">{offer.source_url}</p>
        )}
      </div>

      {/* Edit button */}
      <Tooltip text="Edit offer" position="left">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="flex-shrink-0 text-gray-300 hover:text-gray-500 text-sm transition mt-0.5"
        >
          ✎
        </button>
      </Tooltip>
    </div>
  );
}
