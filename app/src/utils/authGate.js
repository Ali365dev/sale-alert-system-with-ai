import useAuthStore from '../state/authStore';
import useFavoritesStore from '../state/favoritesStore';
import usePreferencesStore from '../state/preferencesStore';
import useLoginPromptStore from '../state/loginPromptStore';
import { saveInterests } from '../services/preferencesApi';

export const isLoggedIn = () => Boolean(useAuthStore.getState().token);

/** Toggle deal favorite; guests trying to *add* see the login sheet. */
export const toggleFavoriteDeal = (dealId) => {
  const { favoriteIds, toggleFavorite } = useFavoritesStore.getState();
  const already = favoriteIds.includes(dealId);
  if (already) {
    toggleFavorite(dealId);
    return true;
  }
  if (!isLoggedIn()) {
    useLoginPromptStore.getState().show('deal');
    return false;
  }
  toggleFavorite(dealId);
  return true;
};

/** Toggle followed store; guests trying to *follow* see the login sheet. */
export const toggleFollowStore = (brandName) => {
  if (!brandName) return false;
  const { followedBrands, toggleFollowedBrand } = usePreferencesStore.getState();
  const already = followedBrands.includes(brandName);
  if (already) {
    toggleFollowedBrand(brandName);
    saveInterests({ brands: usePreferencesStore.getState().followedBrands });
    return true;
  }
  if (!isLoggedIn()) {
    useLoginPromptStore.getState().show('store');
    return false;
  }
  toggleFollowedBrand(brandName);
  saveInterests({ brands: usePreferencesStore.getState().followedBrands });
  return true;
};
