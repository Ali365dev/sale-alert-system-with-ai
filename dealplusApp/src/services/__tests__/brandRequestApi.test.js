jest.mock('../apiInterceptors', () => ({ appAxios: { post: jest.fn() } }));
jest.mock('../../utils/deviceId', () => ({ getDeviceId: () => 'device-123' }));

import { appAxios } from '../apiInterceptors';
import { requestBrand } from '../brandRequestApi';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
});

test('sends the device id, brand name, category, and note', async () => {
  appAxios.post.mockResolvedValue({});
  const ok = await requestBrand({ brandName: 'Acme', category: 'Fashion', note: 'Please add this' });
  expect(ok).toBe(true);
  expect(appAxios.post).toHaveBeenCalledWith('/brand-requests', {
    device_id: 'device-123',
    brand_name: 'Acme',
    category: 'Fashion',
    note: 'Please add this',
  });
});

test('an omitted/empty category or note is sent as undefined, not an empty string', async () => {
  appAxios.post.mockResolvedValue({});
  await requestBrand({ brandName: 'Acme', category: '', note: '' });
  const body = appAxios.post.mock.calls[0][1];
  expect(body.category).toBeUndefined();
  expect(body.note).toBeUndefined();
});

test('returns false (not throwing) when the request fails', async () => {
  appAxios.post.mockRejectedValue(new Error('Network Error'));
  const ok = await requestBrand({ brandName: 'Acme' });
  expect(ok).toBe(false);
});
