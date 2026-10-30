import usePreferencesStore from '../preferencesStore';

const INITIAL_STATE = { favoriteCategories: [], followedBrands: [] };

beforeEach(() => {
  // Merge, not replace — a full replace would also wipe out the store's
  // action functions (toggleCategory, etc.), which live on the same state
  // object zustand's `create()` returns.
  usePreferencesStore.setState(INITIAL_STATE);
});

test('starts with no followed brands or favorite categories', () => {
  const state = usePreferencesStore.getState();
  expect(state.followedBrands).toEqual([]);
  expect(state.favoriteCategories).toEqual([]);
});

test('toggleCategory adds a category that is not yet favorited', () => {
  usePreferencesStore.getState().toggleCategory('Fashion');
  expect(usePreferencesStore.getState().favoriteCategories).toEqual(['Fashion']);
});

test('toggleCategory removes a category that is already favorited', () => {
  usePreferencesStore.getState().toggleCategory('Fashion');
  usePreferencesStore.getState().toggleCategory('Fashion');
  expect(usePreferencesStore.getState().favoriteCategories).toEqual([]);
});

test('toggleFollowedBrand adds then removes a brand name', () => {
  usePreferencesStore.getState().toggleFollowedBrand('Nike');
  expect(usePreferencesStore.getState().followedBrands).toEqual(['Nike']);
  usePreferencesStore.getState().toggleFollowedBrand('Nike');
  expect(usePreferencesStore.getState().followedBrands).toEqual([]);
});

test('setFollowedBrands replaces the whole list', () => {
  usePreferencesStore.getState().toggleFollowedBrand('Old Brand');
  usePreferencesStore.getState().setFollowedBrands(['Nike', 'Acme']);
  expect(usePreferencesStore.getState().followedBrands).toEqual(['Nike', 'Acme']);
});

test('hydrateFromServer overwrites both brands and categories at once', () => {
  usePreferencesStore.getState().toggleFollowedBrand('Local Only Brand');
  usePreferencesStore.getState().hydrateFromServer(['Server Brand'], ['Server Category']);
  const state = usePreferencesStore.getState();
  expect(state.followedBrands).toEqual(['Server Brand']);
  expect(state.favoriteCategories).toEqual(['Server Category']);
});

test('toggling one brand does not affect an unrelated followed brand', () => {
  usePreferencesStore.getState().setFollowedBrands(['Nike', 'Acme']);
  usePreferencesStore.getState().toggleFollowedBrand('Nike');
  expect(usePreferencesStore.getState().followedBrands).toEqual(['Acme']);
});
