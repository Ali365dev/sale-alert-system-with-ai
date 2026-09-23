/** Shared Deal Preference interest chips (profile + onboarding). */

export const DEAL_PREFERENCE_INTERESTS = [
  { name: 'Arts & Design', icon: 'color-palette-outline' },
  { name: 'Anime & Manga', icon: 'happy-outline' },
  { name: 'Videography', icon: 'videocam-outline' },
  { name: 'Afro-fiction', icon: 'book-outline' },
  { name: 'Tech', icon: 'phone-portrait-outline' },
  { name: 'Photography', icon: 'camera-outline' },
  { name: 'Books & Audio', icon: 'library-outline' },
  { name: 'Travel & Flights', icon: 'airplane-outline' },
  { name: 'Gaming & VR', icon: 'game-controller-outline' },
  { name: 'Coffee & Cafes', icon: 'cafe-outline' },
  { name: 'Luxury & Watches', icon: 'watch-outline' },
  { name: 'Beauty & Skincare', icon: 'sparkles-outline' },
  { name: 'Sneakers', icon: 'footsteps-outline' },
  { name: 'Home', icon: 'home-outline' },
  { name: 'Fashion', icon: 'shirt-outline' },
  { name: 'Food', icon: 'restaurant-outline' },
  { name: 'Sports', icon: 'football-outline' },
];

const ICON_MATCH = [
  { match: /art|design/i, icon: 'color-palette-outline' },
  { match: /anime|manga/i, icon: 'happy-outline' },
  { match: /video|film|movie/i, icon: 'videocam-outline' },
  { match: /book|audio|fiction/i, icon: 'library-outline' },
  { match: /tech|electronic|gadget/i, icon: 'phone-portrait-outline' },
  { match: /photo/i, icon: 'camera-outline' },
  { match: /travel|flight/i, icon: 'airplane-outline' },
  { match: /game|gaming|vr/i, icon: 'game-controller-outline' },
  { match: /coffee|cafe|food|dining/i, icon: 'cafe-outline' },
  { match: /watch|luxury|jewel/i, icon: 'watch-outline' },
  { match: /beauty|skin|cosmetic|personal care/i, icon: 'sparkles-outline' },
  { match: /sneaker|shoe|footwear/i, icon: 'footsteps-outline' },
  { match: /home|furniture/i, icon: 'home-outline' },
  { match: /fashion|apparel|clothing/i, icon: 'shirt-outline' },
  { match: /sport|fitness/i, icon: 'football-outline' },
];

export const iconForDealPreference = (name, fallback) =>
  ICON_MATCH.find((c) => c.match.test(name))?.icon ?? fallback ?? 'pricetag-outline';

/** Built-in interests plus any API categories not already in the list. */
export const buildDealPreferenceOptions = (apiCategories = []) => {
  const seen = new Set(DEAL_PREFERENCE_INTERESTS.map((i) => i.name.toLowerCase()));
  const extra = apiCategories
    .filter((c) => c?.name && !seen.has(String(c.name).toLowerCase()))
    .map((c) => ({ name: c.name, icon: iconForDealPreference(c.name) }));
  return [...DEAL_PREFERENCE_INTERESTS, ...extra];
};
