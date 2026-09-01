import useAuthStore from '../authStore';

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
});

test('starts signed out (no token, no user) — a fresh install is a guest', () => {
  expect(useAuthStore.getState().token).toBeNull();
  expect(useAuthStore.getState().user).toBeNull();
});

test('setAuth stores the token and user together', () => {
  useAuthStore.getState().setAuth('abc.def.ghi', { id: 1, email: 'a@b.com', name: 'A' });
  expect(useAuthStore.getState().token).toBe('abc.def.ghi');
  expect(useAuthStore.getState().user).toEqual({ id: 1, email: 'a@b.com', name: 'A' });
});

test('clearAuth (logout) wipes both the token and the user', () => {
  useAuthStore.getState().setAuth('abc.def.ghi', { id: 1, email: 'a@b.com' });
  useAuthStore.getState().clearAuth();
  expect(useAuthStore.getState().token).toBeNull();
  expect(useAuthStore.getState().user).toBeNull();
});
