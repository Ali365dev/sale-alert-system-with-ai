import { appAxios } from './apiInterceptors';
import { handleApiError } from '../utils/handleApiError';
import { deriveAlerts, deriveBrandsAndDeals, deriveCategories } from '../utils/dealAdapters';
import useDataStore from '../state/dataStore';
import usePreferencesStore from '../state/preferencesStore';
import { fetchInterests } from './preferencesApi';

/** Fetches brands + offers in parallel, derives Brand/Deal/Category shapes, and
 * writes the result straight into dataStore — screens read from the store,
 * not from this function's return value. */
export const loadDeals = async () => {
  useDataStore.setState({ loading: true, error: null });
  try {
    const [brandsRes, offersRes] = await Promise.all([
      appAxios.get('/brands'),
      appAxios.get('/offers'),
    ]);
    const apiBrands = brandsRes?.data?.brands || [];
    const apiOffers = offersRes?.data?.offers || [];

    const { brands, deals, brandsById } = deriveBrandsAndDeals(apiBrands, apiOffers);
    const categories = deriveCategories(apiOffers);
    const alerts = deriveAlerts(apiOffers);

    useDataStore.setState({ brands, deals, brandsById, categories, alerts, loading: false });

    // Best-effort sync of saved interests — keeps this device's local prefs
    // aligned with the backend without blocking (or failing) the deals load.
    // Skipped when the server has nothing saved yet, so a brand-new install
    // never clobbers selections mid-onboarding before they're saved.
    fetchInterests().then((interests) => {
      if (interests && (interests.brands.length || interests.categories.length)) {
        usePreferencesStore.getState().hydrateFromServer(interests.brands, interests.categories);
      }
    });

    return { brands, deals, categories, alerts };
  } catch (error) {
    console.log('Error message:', error);
    useDataStore.setState({ error: error?.message ?? 'Failed to load data', loading: false });
    handleApiError(error);
    return null;
  }
};

export const getOffer = async (id) => {
  try {
    const response = await appAxios.get(`/offers/${id}`);
    return response?.data ?? null;
  } catch (error) {
    console.log('Error message:', error);
    handleApiError(error);
    return null;
  }
};
