export type Category = string;

export interface Brand {
  id: string;
  name: string;
  initials: string;
  color: string;
  category: Category;
  dealCount: number;
  description: string;
  coverImage: string;
  website: string | null;
}

export interface Deal {
  id: string;
  brandId: string;
  title: string;
  description: string;
  highlights: string[];
  terms: string;
  discountLabel: string;
  image: string;
  category: Category;
  expiresAt: string;
  promoCode: string | null;
  isFlashSale: boolean;
  isFeatured: boolean;
  isOnline: boolean;
  isInStore: boolean;
  country: string;
  website: string | null;
  isPercentageOff: boolean;
  createdAt: string | null;
}

export interface CategoryInfo {
  name: Category;
  icon: string;
  dealCount: number;
}

export interface AlertItem {
  id: string;
  kind: 'price-drop' | 'new-brand' | 'flash-sale';
  title: string;
  body: string;
  time: string;
  brandId: string | null;
  read: boolean;
}
