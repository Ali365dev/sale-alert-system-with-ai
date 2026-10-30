import useOnboardingStore from '../onboardingStore';

beforeEach(() => {
  useOnboardingStore.setState({ topics: [], brandIds: [] });
});

test('starts empty (nothing selected yet)', () => {
  expect(useOnboardingStore.getState().topics).toEqual([]);
  expect(useOnboardingStore.getState().brandIds).toEqual([]);
});

test('toggleTopic selects then deselects a topic', () => {
  useOnboardingStore.getState().toggleTopic('Fashion');
  expect(useOnboardingStore.getState().topics).toEqual(['Fashion']);
  useOnboardingStore.getState().toggleTopic('Fashion');
  expect(useOnboardingStore.getState().topics).toEqual([]);
});

test('toggleBrand selects then deselects a brand id independently of topics', () => {
  useOnboardingStore.getState().toggleTopic('Fashion');
  useOnboardingStore.getState().toggleBrand('nike');
  expect(useOnboardingStore.getState().brandIds).toEqual(['nike']);
  expect(useOnboardingStore.getState().topics).toEqual(['Fashion']);

  useOnboardingStore.getState().toggleBrand('nike');
  expect(useOnboardingStore.getState().brandIds).toEqual([]);
});

test('multiple selections accumulate in order', () => {
  useOnboardingStore.getState().toggleBrand('nike');
  useOnboardingStore.getState().toggleBrand('acme');
  expect(useOnboardingStore.getState().brandIds).toEqual(['nike', 'acme']);
});
