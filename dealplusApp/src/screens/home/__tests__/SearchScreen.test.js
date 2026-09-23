const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockRouteParams = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: mockCanGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SearchScreen from '../SearchScreen';
import useDataStore from '../../../state/dataStore';

const brandsById = {
  nike: { id: 'nike', name: 'Nike', initials: 'N', logoUrl: null, website: null, dealCount: 2 },
  acme: { id: 'acme', name: 'Acme', initials: 'A', logoUrl: null, website: null, dealCount: 1 },
  otherco: { id: 'otherco', name: 'Other Co', initials: 'O', logoUrl: null, website: null, dealCount: 1 },
};

const brands = Object.values(brandsById);

const baseDeals = [
  {
    id: '1',
    brandId: 'nike',
    title: 'Nike Air Max Sale',
    description: 'Great shoes',
    category: 'Footwear',
    discountLabel: '-70%',
    isPercentageOff: true,
    createdAt: '2026-01-03T00:00:00Z',
    expiresAt: '2026-02-01T00:00:00Z',
  },
  {
    id: '2',
    brandId: 'acme',
    title: 'Acme Widget Deal',
    description: 'Widgets galore',
    category: 'Tech',
    discountLabel: '-20%',
    isPercentageOff: true,
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-10T00:00:00Z',
  },
  {
    id: '3',
    brandId: 'otherco',
    title: 'Buy One Get One',
    description: 'BOGO offer',
    category: 'Fashion',
    discountLabel: 'BOGO',
    isPercentageOff: false,
    createdAt: '2026-01-05T00:00:00Z',
    expiresAt: '2026-03-01T00:00:00Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockRouteParams = {};
  useDataStore.setState({ deals: baseDeals, brands, brandsById, categories: [] });
});

describe('idle search home', () => {
  test('shows recent searches, popular stores, and the Search action', async () => {
    const { getByText, getByPlaceholderText } = await render(<SearchScreen />);
    expect(getByPlaceholderText('Search stores & deals')).toBeTruthy();
    expect(getByText('Search')).toBeTruthy();
    expect(getByText('Recent Searches')).toBeTruthy();
    expect(getByText('Popular stores')).toBeTruthy();
    expect(getByText('Nike')).toBeTruthy();
    expect(getByText('2 Codes')).toBeTruthy();
  });

  test('"Clear" removes the recent searches section', async () => {
    const { getByText, queryByText, getAllByText } = await render(<SearchScreen />);
    expect(getByText('Recent Searches')).toBeTruthy();
    await fireEvent.press(getAllByText('Clear')[0]);
    expect(queryByText('Recent Searches')).toBeNull();
  });

  test('tapping a popular store opens BrandDetailScreen and adds Store Searches', async () => {
    const { getByText, getAllByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Nike'));
    expect(mockNavigate).toHaveBeenCalledWith('BrandDetailScreen', { id: 'nike' });
    expect(getByText('Store Searches')).toBeTruthy();
    expect(getAllByText('Nike').length).toBeGreaterThan(1);
  });

  test('clearing store searches removes that section', async () => {
    const { getByText, queryByText, getAllByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Nike'));
    expect(getByText('Store Searches')).toBeTruthy();
    const clears = getAllByText('Clear');
    expect(clears.length).toBeGreaterThanOrEqual(2);
    await fireEvent.press(clears[clears.length - 1]);
    expect(queryByText('Store Searches')).toBeNull();
  });
});

describe('running a search', () => {
  test('pressing Search with a query shows matching deals', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search stores & deals'), 'Air Max');
    await fireEvent.press(getByText('Search'));
    expect(getByText('Nike Air Max Sale')).toBeTruthy();
    expect(queryByText('Acme Widget Deal')).toBeNull();
    expect(queryByText('Popular stores')).toBeNull();
  });

  test('matches by brand name as well as by title', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search stores & deals'), 'acme');
    await fireEvent.press(getByText('Search'));
    expect(getByText('Acme Widget Deal')).toBeTruthy();
  });

  test('search is case-insensitive', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search stores & deals'), 'NIKE');
    await fireEvent.press(getByText('Search'));
    expect(getByText('Nike Air Max Sale')).toBeTruthy();
  });

  test('a query matching nothing shows the "No results" empty state', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search stores & deals'), 'zzz-nonexistent');
    await fireEvent.press(getByText('Search'));
    expect(getByText('No results')).toBeTruthy();
  });

  test('clearing the query returns to the idle search home', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<SearchScreen />);
    const input = getByPlaceholderText('Search stores & deals');
    await fireEvent.changeText(input, 'nike');
    await fireEvent.press(getByText('Search'));
    expect(queryByText('Popular stores')).toBeNull();
    await fireEvent.changeText(input, '');
    expect(getByText('Popular stores')).toBeTruthy();
  });

  test('submitting from the keyboard runs the search', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    const input = getByPlaceholderText('Search stores & deals');
    await fireEvent.changeText(input, 'Air Max');
    await fireEvent(input, 'submitEditing');
    expect(getByText('Nike Air Max Sale')).toBeTruthy();
  });
});

describe('recent searches', () => {
  test('tapping a recent search chip runs it as the active search query', async () => {
    const { getByText, queryByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('seafood'));
    expect(queryByText('Popular stores')).toBeNull();
    expect(getByText('No results')).toBeTruthy();
  });
});

describe('results view', () => {
  test('pressing a deal card navigates to DealDetailScreen with a transitionTag', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search stores & deals'), 'Air Max');
    await fireEvent.press(getByText('Search'));
    await fireEvent.press(getByText('Flat 70% Off'));
    expect(mockNavigate).toHaveBeenCalledWith('DealDetailScreen', { id: '1', transitionTag: 'search-1' });
  });

  test('arriving with a route.params.category jumps straight to filtered results', async () => {
    mockRouteParams = { category: 'Tech' };
    const { getByText, queryByText } = await render(<SearchScreen />);
    expect(queryByText('Popular stores')).toBeNull();
    expect(getByText('Acme Widget Deal')).toBeTruthy();
  });
});

describe('empty deals (nothing loaded yet)', () => {
  test('shows empty popular stores when there is no brand data', async () => {
    useDataStore.setState({ deals: [], brands: [], brandsById: {}, categories: [] });
    const { getByText } = await render(<SearchScreen />);
    expect(getByText('No stores yet')).toBeTruthy();
  });
});

describe('pagination', () => {
  const manyDeals = Array.from({ length: 15 }, (_, i) => ({
    id: `deal-${i}`,
    brandId: 'nike',
    title: `Deal Number ${i}`,
    description: 'x',
    category: 'Footwear',
    discountLabel: '-10%',
    isPercentageOff: true,
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-02-01T00:00:00Z',
  }));

  beforeEach(() => {
    jest.useFakeTimers();
    useDataStore.setState({ deals: manyDeals, brands, brandsById, categories: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('only renders the first page of results, not all of them at once', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search stores & deals'), 'Deal Number');
    await fireEvent.press(getByText('Search'));

    expect(getByText('Deal Number 0')).toBeTruthy();
    expect(queryByText('Deal Number 14')).toBeNull();
  });
});
