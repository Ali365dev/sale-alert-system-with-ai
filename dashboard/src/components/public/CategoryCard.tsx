import type { LucideIcon } from "lucide-react";
import { Baby, Dumbbell, Footprints, Gem, Headphones, House, Laptop, Plane, Shirt, ShoppingBasket, Sparkles, Tag, UtensilsCrossed } from "lucide-react";

import { TONE_BG, TONE_FG, toneForName } from "../../lib/publicOffers";
import "./CategoryCard.css";

const CATEGORY_ICONS: { test: RegExp; icon: LucideIcon }[] = [
  { test: /fashion|clothing|apparel/i, icon: Shirt },
  { test: /electronic|tech/i, icon: Headphones },
  { test: /software|web|service/i, icon: Laptop },
  { test: /home|living|furniture/i, icon: House },
  { test: /beauty|cosmetic|personal care/i, icon: Sparkles },
  { test: /shoe|footwear/i, icon: Footprints },
  { test: /sport|fitness/i, icon: Dumbbell },
  { test: /kid|baby|toy/i, icon: Baby },
  { test: /accessor|bag|jewel/i, icon: Gem },
  { test: /travel|flight|hotel/i, icon: Plane },
  { test: /food|restaurant/i, icon: UtensilsCrossed },
  { test: /grocery/i, icon: ShoppingBasket },
];

function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS.find((item) => item.test.test(name))?.icon ?? Tag;
}

export function CategoryCard({
  name,
  offerCount,
  active,
  onClick,
}: {
  name: string;
  offerCount: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const tone = toneForName(name);
  const Icon = categoryIcon(name);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`category-card${active ? " is-active" : ""}${offerCount === 0 ? " is-empty" : ""}`}
      aria-pressed={active}
    >
      <span className="category-card-icon" style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}>
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="category-card-text">
        <span className="category-card-name">{name}</span>
        <span className="category-card-count">
          {offerCount === 0 ? "Coming soon" : `${offerCount} ${offerCount === 1 ? "deal" : "deals"}`}
        </span>
      </span>
    </button>
  );
}
