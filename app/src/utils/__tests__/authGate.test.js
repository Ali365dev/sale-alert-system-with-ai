import useAuthStore from '../../state/authStore';
import useFavoritesStore from '../../state/favoritesStore';
import usePreferencesStore from '../../state/preferencesStore';
import useLoginPromptStore from '../../state/loginPromptStore';
import { toggleFavoriteDeal, toggleFollowStore } from '../authGate';

jest.mock('../../services/preferencesApi', () => ({ saveInterests: jest.fn() }));

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
  useFavoritesStore.setState({ favoriteIds: [] });
  usePreferencesStore.setState({ followedBrands: [], favoriteCategories: [] });
  useLoginPromptStore.setState({ open: false, kind: 'deal' });
});

test('guest adding a favorite opens the login sheet and does not favorite', () => {
  expect(toggleFavoriteDeal('deal-1')).toBe(false);
  expect(useFavoritesStore.getState().favoriteIds).toEqual([]);
  expect(useLoginPromptStore.getState()).toMatchObject({ open: true, kind: 'deal' });
});

test('signed-in user can add a favorite', () => {
  useAuthStore.setState({ token: 'tok', user: { id: 1 } });
  expect(toggleFavoriteDeal('deal-1')).toBe(true);
  expect(useFavoritesStore.getState().favoriteIds).toEqual(['deal-1']);
  expect(useLoginPromptStore.getState().open).toBe(false);
});

test('guest can still remove an already-favorited deal', () => {
  useFavoritesStore.setState({ favoriteIds: ['deal-1'] });
  expect(toggleFavoriteDeal('deal-1')).toBe(true);
  expect(useFavoritesStore.getState().favoriteIds).toEqual([]);
  expect(useLoginPromptStore.getState().open).toBe(false);
});

test('guest following a store opens the login sheet', () => {
  expect(toggleFollowStore('Nike')).toBe(false);
  expect(usePreferencesStore.getState().followedBrands).toEqual([]);
  expect(useLoginPromptStore.getState()).toMatchObject({ open: true, kind: 'store' });
});

test('signed-in user can follow a store', () => {
  useAuthStore.setState({ token: 'tok', user: { id: 1 } });
  expect(toggleFollowStore('Nike')).toBe(true);
  expect(usePreferencesStore.getState().followedBrands).toEqual(['Nike']);
});
