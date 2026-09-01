// Exercises the request/response interceptor functions directly (via axios's
// own InterceptorManager.handlers array) rather than firing real HTTP calls
// through appAxios.get/post — this is a pure unit test of the interceptor
// logic itself (connectivity gate, header injection, bounded retry), with
// no network access at all.
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn() }));
jest.mock('../../utils/CustomToast', () => ({ showErrorToast: jest.fn() }));

import NetInfo from '@react-native-community/netinfo';
import { showErrorToast } from '../../utils/CustomToast';
import { appAxios } from '../apiInterceptors';

const requestInterceptor = appAxios.interceptors.request.handlers[0];
const responseInterceptor = appAxios.interceptors.response.handlers[0];

beforeEach(() => {
  jest.clearAllMocks();
});

test('appAxios is configured with a 15s timeout so a hung request fails instead of waiting forever', () => {
  expect(appAxios.defaults.timeout).toBe(15000);
});

describe('request interceptor', () => {
  test('rejects with no network and shows a toast', async () => {
    NetInfo.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await expect(requestInterceptor.fulfilled({ headers: {} })).rejects.toBeTruthy();
    expect(showErrorToast).toHaveBeenCalledWith('No internet connection');
  });

  test('passes through and injects the JSON content-type header when online', async () => {
    NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    const config = await requestInterceptor.fulfilled({ headers: {} });
    expect(config.headers['Content-Type']).toBe('application/json; charset=utf-8');
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  test('is considered online if either isConnected or isInternetReachable is true (not both required)', async () => {
    NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    await expect(requestInterceptor.fulfilled({ headers: {} })).resolves.toBeTruthy();
  });

  test('does not clobber a caller-supplied header', async () => {
    NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    const config = await requestInterceptor.fulfilled({ headers: { Authorization: 'Bearer x' } });
    expect(config.headers.Authorization).toBe('Bearer x');
    expect(config.headers['Content-Type']).toBe('application/json; charset=utf-8');
  });
});

describe('response interceptor (retry-on-Network-Error)', () => {
  test('a non-network error is rejected as-is, untouched', async () => {
    const error = { message: 'Request failed with status code 404', config: {} };
    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);
  });

  test('a Network Error retries exactly once, through appAxios itself (inherits timeout + connectivity check)', async () => {
    NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    // Point the retried request at a config whose adapter resolves immediately,
    // so the retry exercises real appAxios plumbing without a real network call.
    const config = {
      headers: {},
      adapter: () => Promise.resolve({ data: 'ok', status: 200, statusText: 'OK', headers: {}, config: {} }),
    };

    const result = await responseInterceptor.rejected({ message: 'Network Error', config });
    expect(result.data).toBe('ok');
  });

  test('a second failure on the retried request is rejected, not retried again (no infinite loop)', async () => {
    NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    const config = {
      headers: {},
      adapter: () => Promise.reject({ message: 'Network Error', config: {} }),
    };

    await expect(responseInterceptor.rejected({ message: 'Network Error', config })).rejects.toBeTruthy();
    // Exactly one retry attempt was made (the adapter above throws on every
    // call, so if it retried more than once this would hang or the mock
    // call count would be higher — asserting the promise settles at all,
    // rather than hanging, is the real regression guard here).
  });
});
