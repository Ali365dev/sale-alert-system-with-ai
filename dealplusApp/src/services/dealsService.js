import { appAxios } from './apiInterceptors';
import { handleApiError } from '../utils/handleApiError';
import { deriveAlerts, deriveBrandsAndDeals, deriveCategories } from '../utils/dealAdapters';
import useDataStore from '../state/dataStore';
import usePreferencesStore from '../state/preferencesStore';
import { fetchInterests } from './preferencesApi';

const CATALOG_TIMEOUT_MS = 15000;
// Hosted API (Render) cold-starts past 15s. One longer retry covers that
// without stacking a new request on every navigation or app-foreground.
const CATALOG_RETRY_TIMEOUT_MS = 45000;

const isTimeout = (error) =>
  error?.code === 'ECONNABORTED' || /timeout of \d+ms exceeded/i.test(error?.message || '');

const fetchCatalog = (timeout) =>
  Promise.all([
    appAxios.get('/brands', { timeout }),
    // Full catalog. Passing device_id turns on personalization, and a brand-new
    // install has no saved brands/categories, so the API returns zero offers.
    appAxios.get('/offers', { timeout }),
    appAxios.get('/categories', { timeout }).catch(() => ({ data: { categories: [] } })),
  ]);

let inflight = null;

/** Fetches brands + offers in parallel, derives Brand/Deal/Category shapes, and
 * writes the result straight into dataStore — screens read from the store,
 * not from this function's return value.
 * Concurrent callers (launch, foreground, pull-to-refresh) share one request
 * so navigation cannot pile up hung calls. */
export const loadDeals = () => {
  if (inflight) return inflight;
  inflight = loadDealsOnce().finally(() => {
    inflight = null;
  });
  return inflight;
};

const loadDealsOnce = async () => {
  useDataStore.setState({ loading: true, error: null });
  try {
    let brandsRes;
    let offersRes;
    let categoriesRes;
    try {
      [brandsRes, offersRes, categoriesRes] = await fetchCatalog(CATALOG_TIMEOUT_MS);
    } catch (error) {
      if (!isTimeout(error)) throw error;
      [brandsRes, offersRes, categoriesRes] = await fetchCatalog(CATALOG_RETRY_TIMEOUT_MS);
    }
    const apiBrands = brandsRes?.data?.brands || [];
    const apiOffers = offersRes?.data?.offers || [];
    const managedCategories = categoriesRes?.data?.categories || [];

    const { brands, deals, brandsById } = deriveBrandsAndDeals(apiBrands, apiOffers);
    const categories = deriveCategories(apiOffers, apiBrands, managedCategories);
    const derivedAlerts = deriveAlerts(apiOffers, brands);

    // Alerts pushed in via FCM (id-prefixed 'push-') aren't derived from
    // offers, so a plain overwrite here would silently drop them on the next
    // app open or pull-to-refresh. Keep them layered on top instead.
    const pushAlerts = useDataStore.getState().alerts.filter((a) => a.id?.startsWith('push-'));
    const alerts = [...pushAlerts, ...derivedAlerts];

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
    const hasCachedCatalog =
      useDataStore.getState().deals.length > 0 || useDataStore.getState().brands.length > 0;
    useDataStore.setState({
      error: hasCachedCatalog ? null : error?.message ?? 'Failed to load data',
      loading: false,
    });
    if (!hasCachedCatalog) handleApiError(error);
    return null;
  }
};

export const getOffer = async (id) => {
  try {
    const response = await appAxios.get(`/offers/${id}`);
    return response?.data ?? null;
  } catch (error) {
    handleApiError(error);
    return null;
  }
};
