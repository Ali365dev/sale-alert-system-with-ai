jest.mock('../apiInterceptors', () => ({ appAxios: { put: jest.fn(), get: jest.fn() } }));
jest.mock('../../utils/deviceId', () => ({ getDeviceId: () => 'device-123' }));

import { appAxios } from '../apiInterceptors';
import { fetchInterests, saveInterests } from '../preferencesApi';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
});

describe('saveInterests', () => {
  test('sends both brands and categories when both are given', async () => {
    appAxios.put.mockResolvedValue({});
    await saveInterests({ brands: ['Nike'], categories: ['Fashion'] });
    expect(appAxios.put).toHaveBeenCalledWith('/preferences', {
      device_id: 'device-123',
      brands: ['Nike'],
      categories: ['Fashion'],
    });
  });

  test('a categories-only save omits the brands field entirely (so the backend does not wipe it)', async () => {
    appAxios.put.mockResolvedValue({});
    await saveInterests({ categories: ['Fashion'] });
    const body = appAxios.put.mock.calls[0][1];
    expect(body).not.toHaveProperty('brands');
    expect(body.categories).toEqual(['Fashion']);
  });

  test('a brands-only save omits the categories field entirely', async () => {
    appAxios.put.mockResolvedValue({});
    await saveInterests({ brands: ['Nike'] });
    const body = appAxios.put.mock.calls[0][1];
    expect(body).not.toHaveProperty('categories');
  });

  test('an empty array is still sent (distinct from omitting the field)', async () => {
    appAxios.put.mockResolvedValue({});
    await saveInterests({ brands: [] });
    const body = appAxios.put.mock.calls[0][1];
    expect(body.brands).toEqual([]);
  });

  test('a network failure is swallowed, not thrown, so the caller UI never crashes', async () => {
    appAxios.put.mockRejectedValue(new Error('Network Error'));
    await expect(saveInterests({ brands: ['Nike'] })).resolves.toBeUndefined();
  });

  test('called with no arguments at all does not throw', async () => {
    appAxios.put.mockResolvedValue({});
    await expect(saveInterests()).resolves.toBeUndefined();
    const body = appAxios.put.mock.calls[0][1];
    expect(body).toEqual({ device_id: 'device-123' });
  });
});

describe('fetchInterests', () => {
  test('returns brands/categories from a successful response', async () => {
    appAxios.get.mockResolvedValue({ data: { brands: ['Nike'], categories: ['Fashion'] } });
    const result = await fetchInterests();
    expect(result).toEqual({ brands: ['Nike'], categories: ['Fashion'] });
    expect(appAxios.get).toHaveBeenCalledWith('/preferences', { params: { device_id: 'device-123' } });
  });

  test('a response with no saved data yet defaults to empty arrays, not undefined', async () => {
    appAxios.get.mockResolvedValue({ data: {} });
    const result = await fetchInterests();
    expect(result).toEqual({ brands: [], categories: [] });
  });

  test('returns null (not throwing) on API failure, so callers can treat it as "nothing to hydrate"', async () => {
    appAxios.get.mockRejectedValue(new Error('Network Error'));
    const result = await fetchInterests();
    expect(result).toBeNull();
  });
});
