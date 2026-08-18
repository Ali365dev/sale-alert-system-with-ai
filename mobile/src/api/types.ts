export interface ApiBrand {
  id: number;
  name: string;
  website: string | null;
  categories: string[];
  emails: string[];
  is_active: boolean;
  last_searched: string | null;
  created_at: string | null;
}

export interface ApiOffer {
  id: number;
  email_id: number | null;
  title: string | null;
  brand: string | null;
  company: string | null;
  category: string | null;
  subcategory: string | null;
  offer_type: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  expiry_date: string | null;
  offer_value: string | null;
  website: string | null;
  summary: string | null;
  key_highlights: string[];
  is_active: boolean;
  created_at: string | null;
  verification_status: 'verified' | 'suspicious' | 'invalid' | null;
  verification_reason: string | null;
  verification_confidence: number | null;
  verified_at: string | null;
}

export interface BrandsResponse {
  brands: ApiBrand[];
  summary: {
    total: number;
    active: number;
    ever_searched: number;
    known_sender_emails: number;
  };
}

export interface OffersResponse {
  offers: ApiOffer[];
  summary: {
    total: number;
    verified: number;
    suspicious: number;
    invalid: number;
    unverified: number;
    active: number;
  };
}
