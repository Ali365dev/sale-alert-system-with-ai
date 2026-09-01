import useFavoritesStore from '../favoritesStore';

beforeEach(() => {
  useFavoritesStore.setState({ favoriteIds: [] });
});

test('starts with no favorites', () => {
  expect(useFavoritesStore.getState().favoriteIds).toEqual([]);
  expect(useFavoritesStore.getState().isFavorite('1')).toBe(false);
});

test('toggleFavorite marks a deal as favorited', () => {
  useFavoritesStore.getState().toggleFavorite('deal-1');
  expect(useFavoritesStore.getState().isFavorite('deal-1')).toBe(true);
  expect(useFavoritesStore.getState().favoriteIds).toEqual(['deal-1']);
});

test('toggleFavorite twice on the same id un-favorites it', () => {
  useFavoritesStore.getState().toggleFavorite('deal-1');
  useFavoritesStore.getState().toggleFavorite('deal-1');
  expect(useFavoritesStore.getState().isFavorite('deal-1')).toBe(false);
  expect(useFavoritesStore.getState().favoriteIds).toEqual([]);
});

test('favoriting multiple deals keeps each independent', () => {
  useFavoritesStore.getState().toggleFavorite('deal-1');
  useFavoritesStore.getState().toggleFavorite('deal-2');
  useFavoritesStore.getState().toggleFavorite('deal-1');
  expect(useFavoritesStore.getState().favoriteIds).toEqual(['deal-2']);
});
