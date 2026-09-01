jest.mock('../apiInterceptors', () => ({ appAxios: { get: jest.fn() } }));
jest.mock('../../utils/handleApiError', () => ({ handleApiError: jest.fn() }));

import { appAxios } from '../apiInterceptors';
import { handleApiError } from '../../utils/handleApiError';
import { getOffer, loadDeals } from '../dealsService';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

const mockEndpoint = (map) => {
  appAxios.get.mockImplementation((url) => {
    if (map[url]) return Promise.resolve(map[url]);
    return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  useDataStore.setState({ brands: [], deals: [], categories: [], alerts: [], brandsById: {}, loading: true, error: null });
  usePreferencesStore.setState({ followedBrands: [], favoriteCategories: [] });
});

afterEach(() => {
  console.log.mockRestore();
});

describe('loadDeals', () => {
  test('on success, derives and stores brands/deals/categories/alerts and clears the loading flag', async () => {
    mockEndpoint({
      '/brands': { data: { brands: [{ id: 1, name: 'Acme', categories: ['Fashion'] }] } },
      '/offers': { data: { offers: [{ id: 1, brand: 'Acme', category: 'Fashion', created_at: '2026-01-01T00:00:00Z' }] } },
      '/preferences': { data: {} },
    });

    const result = await loadDeals();
    await flushMicrotasks();

    const state = useDataStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.brands).toHaveLength(1);
    expect(state.deals).toHaveLength(1);
    expect(state.categories).toEqual([{ name: 'Fashion', dealCount: 1, icon: expect.any(String) }]);
    expect(result.brands).toHaveLength(1);
  });

  test('sets loading true immediately, before the API calls resolve', () => {
    let resolveBrands;
    appAxios.get.mockImplementation((url) => {
      if (url === '/brands') return new Promise((r) => (resolveBrands = r));
      return Promise.resolve({ data: {} });
    });

    useDataStore.setState({ loading: false });
    const promise = loadDeals();
    expect(useDataStore.getState().loading).toBe(true);

    resolveBrands({ data: {} });
    return promise;
  });

  test('on API failure, sets the error state, stops loading, and reports via handleApiError', async () => {
    appAxios.get.mockRejectedValue(new Error('Network Error'));

    const result = await loadDeals();

    expect(result).toBeNull();
    const state = useDataStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Network Error');
    expect(handleApiError).toHaveBeenCalledTimes(1);
  });

  test('hydrates followed brands/categories from the server when the server has saved data', async () => {
    mockEndpoint({
      '/brands': { data: { brands: [] } },
      '/offers': { data: { offers: [] } },
      '/preferences': { data: { brands: ['Nike'], categories: ['Footwear'] } },
    });

    await loadDeals();
    await flushMicrotasks();

    expect(usePreferencesStore.getState().followedBrands).toEqual(['Nike']);
    expect(usePreferencesStore.getState().favoriteCategories).toEqual(['Footwear']);
  });

  test('does NOT hydrate (and does not clobber local prefs) when the server has nothing saved yet', async () => {
    usePreferencesStore.setState({ followedBrands: ['Locally Followed'], favoriteCategories: [] });
    mockEndpoint({
      '/brands': { data: { brands: [] } },
      '/offers': { data: { offers: [] } },
      '/preferences': { data: { brands: [], categories: [] } },
    });

    await loadDeals();
    await flushMicrotasks();

    expect(usePreferencesStore.getState().followedBrands).toEqual(['Locally Followed']);
  });

  test('missing brands/offers arrays in the response default to empty (no crash)', async () => {
    mockEndpoint({ '/brands': { data: {} }, '/offers': { data: {} }, '/preferences': { data: {} } });

    const result = await loadDeals();

    expect(result.brands).toEqual([]);
    expect(result.deals).toEqual([]);
  });
});

describe('getOffer', () => {
  test('returns the offer payload on success', async () => {
    appAxios.get.mockResolvedValue({ data: { id: 5, brand: 'Acme' } });
    const offer = await getOffer(5);
    expect(appAxios.get).toHaveBeenCalledWith('/offers/5');
    expect(offer).toEqual({ id: 5, brand: 'Acme' });
  });

  test('returns null and reports the error on failure', async () => {
    appAxios.get.mockRejectedValue(new Error('not found'));
    const offer = await getOffer(999);
    expect(offer).toBeNull();
    expect(handleApiError).toHaveBeenCalledTimes(1);
  });
});
