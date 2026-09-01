jest.mock('../apiInterceptors', () => ({ appAxios: { post: jest.fn() } }));
jest.mock('../../utils/deviceId', () => ({ getDeviceId: () => 'device-123' }));

import { appAxios } from '../apiInterceptors';
import { login, signup } from '../authApi';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signup', () => {
  test('sends email, password, name, and this device\'s id', async () => {
    appAxios.post.mockResolvedValue({ data: { token: 't', user: { id: 1, email: 'a@b.com' }, brands: [], categories: [] } });
    await signup({ email: 'a@b.com', password: 'password123', name: 'Alex' });
    expect(appAxios.post).toHaveBeenCalledWith('/auth/signup', {
      email: 'a@b.com',
      password: 'password123',
      name: 'Alex',
      device_id: 'device-123',
    });
  });

  test('returns { ok: true, ...data } on success', async () => {
    appAxios.post.mockResolvedValue({ data: { token: 't', user: { id: 1 }, brands: ['Nike'], categories: [] } });
    const result = await signup({ email: 'a@b.com', password: 'password123' });
    expect(result).toEqual({ ok: true, token: 't', user: { id: 1 }, brands: ['Nike'], categories: [] });
  });

  test('returns { ok: false, error } using the backend\'s message on failure (e.g. duplicate email)', async () => {
    appAxios.post.mockRejectedValue({ response: { data: { error: 'An account with this email already exists.' } } });
    const result = await signup({ email: 'a@b.com', password: 'password123' });
    expect(result).toEqual({ ok: false, error: 'An account with this email already exists.' });
  });

  test('falls back to a generic error message when the backend gives no error detail (e.g. network failure)', async () => {
    appAxios.post.mockRejectedValue(new Error('Network Error'));
    const result = await signup({ email: 'a@b.com', password: 'password123' });
    expect(result).toEqual({ ok: false, error: 'Something went wrong. Please try again.' });
  });
});

describe('login', () => {
  test('sends email, password, and the device id', async () => {
    appAxios.post.mockResolvedValue({ data: { token: 't', user: { id: 1 }, brands: [], categories: [] } });
    await login({ email: 'a@b.com', password: 'password123' });
    expect(appAxios.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'password123',
      device_id: 'device-123',
    });
  });

  test('returns { ok: false, error } for incorrect credentials', async () => {
    appAxios.post.mockRejectedValue({ response: { data: { error: 'Incorrect email or password.' } } });
    const result = await login({ email: 'a@b.com', password: 'wrong' });
    expect(result).toEqual({ ok: false, error: 'Incorrect email or password.' });
  });
});
