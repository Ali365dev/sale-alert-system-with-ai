import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import useDataStore from '../dataStore';
import { Storage, mmkvStorage } from '../storage';

test('dataStore persists brands/categories to MMKV and a fresh store rehydrates them from disk', () => {
  useDataStore.getState().setBrandsAndDeals(
    [{ id: 1, name: 'LOGO' }],
    [{ id: 10, title: 'Sale' }],
    { 1: { id: 1, name: 'LOGO' } },
  );
  useDataStore.getState().setCategories([{ name: 'Fashion' }]);

  const raw = Storage.getString('data-storage');
  expect(raw).toBeTruthy();
  const persisted = JSON.parse(raw).state;
  expect(persisted.brands).toEqual([{ id: 1, name: 'LOGO' }]);
  expect(persisted.categories).toEqual([{ name: 'Fashion' }]);

  // Same on-disk MMKV file (the `Storage` singleton), but a brand-new zustand
  // store instance — this is what a real app relaunch does: read whatever
  // was last written to disk, not carry over in-memory state.
  const useDataStoreFresh = create()(
    persist((set) => ({ brands: [], categories: [] }), {
      name: 'data-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }),
  );

  expect(useDataStoreFresh.getState().brands).toEqual([{ id: 1, name: 'LOGO' }]);
  expect(useDataStoreFresh.getState().categories).toEqual([{ name: 'Fashion' }]);
});
