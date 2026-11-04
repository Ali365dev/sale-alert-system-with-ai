import type { ScrapedOffer } from "../../types";
import { OfferCard } from "./OfferCard";

interface Props {
  offers: ScrapedOffer[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onChange: (key: string, updated: ScrapedOffer) => void;
}

export function OfferList({ offers, selected, onToggle, onSelectAll, onClearAll, onChange }: Props) {
  const allSelected = offers.length > 0 && selected.size === offers.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3">
        <p className="text-xs font-semibold text-t1">
          {offers.length} offer{offers.length !== 1 ? "s" : ""} found
        </p>
        <button
          onClick={allSelected ? onClearAll : onSelectAll}
          className="text-xs text-primary font-semibold hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5 px-3">
        {offers.map((offer) => {
          const key = offer._key ?? offer.offer_url;
          return (
            <OfferCard
              key={key}
              offer={offer}
              selected={selected.has(key)}
              onToggle={() => onToggle(key)}
              onChange={(updated) => onChange(key, updated)}
            />
          );
        })}
      </div>
    </div>
  );
}
