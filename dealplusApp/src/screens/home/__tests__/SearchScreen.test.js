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
  nike: { name: 'Nike' },
  acme: { name: 'Acme' },
  otherco: { name: 'Other Co' },
};

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

const categories = [{ name: 'Footwear' }, { name: 'Tech' }, { name: 'Fashion' }];

const titleOrder = (tree, titles) => {
  const json = JSON.stringify(tree);
  return titles.map((t) => json.indexOf(`"${t}"`));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockRouteParams = {};
  useDataStore.setState({ deals: baseDeals, categories, brandsById });
});

describe('filter panel (default view, no query, no results shown yet)', () => {
  test('shows the category, discount, and sort filter sections with a live result count', async () => {
    const { getByText } = await render(<SearchScreen />);
    expect(getByText('Categories')).toBeTruthy();
    expect(getByText('Discount Range')).toBeTruthy();
    expect(getByText('Sort By')).toBeTruthy();
    expect(getByText('Show Results (3)')).toBeTruthy();
  });

  test('selecting a category updates the live result count in "Show Results"', async () => {
    const { getByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Footwear'));
    expect(getByText('Show Results (1)')).toBeTruthy();
  });

  test('pressing an already-selected category chip deselects it (count returns to all deals)', async () => {
    const { getByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Footwear'));
    await fireEvent.press(getByText('Footwear'));
    expect(getByText('Show Results (3)')).toBeTruthy();
  });

  test('selecting a minimum discount tier filters out deals below it', async () => {
    const { getByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('50%+'));
    // Only the -70% Nike deal clears a 50% floor; -20% and BOGO (0%) do not.
    expect(getByText('Show Results (1)')).toBeTruthy();
  });

  test('"Clear All" removes the recent searches section', async () => {
    const { getByText, queryByText } = await render(<SearchScreen />);
    expect(getByText('Recent Searches')).toBeTruthy();
    await fireEvent.press(getByText('Clear All'));
    expect(queryByText('Recent Searches')).toBeNull();
  });
});

describe('typing a search query', () => {
  test('typing immediately shows filtered results without needing "Show Results"', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search deals, brands, categories...'), 'Air Max');
    expect(getByText('Nike Air Max Sale')).toBeTruthy();
    expect(queryByText('Acme Widget Deal')).toBeNull();
    expect(queryByText('Categories')).toBeNull();
  });

  test('matches by brand name as well as by title', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search deals, brands, categories...'), 'acme');
    expect(getByText('Acme Widget Deal')).toBeTruthy();
  });

  test('search is case-insensitive', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search deals, brands, categories...'), 'NIKE');
    expect(getByText('Nike Air Max Sale')).toBeTruthy();
  });

  test('a query matching nothing shows the "No results" empty state', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search deals, brands, categories...'), 'zzz-nonexistent');
    expect(getByText('No results')).toBeTruthy();
  });

  test('clearing the query back to empty returns to the filter panel', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(<SearchScreen />);
    const input = getByPlaceholderText('Search deals, brands, categories...');
    await fireEvent.changeText(input, 'nike');
    expect(queryByText('Categories')).toBeNull();
    await fireEvent.changeText(input, '');
    expect(getByText('Categories')).toBeTruthy();
  });
});

describe('recent searches', () => {
  test('tapping a recent search chip runs it as the active search query', async () => {
    const { getByText, queryByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Flash sale'));
    // None of the sample deals match "Flash sale" — the filter panel should
    // be gone (query is non-empty) and the empty state should show, proving
    // the tap actually drove a real search rather than just highlighting it.
    expect(queryByText('Categories')).toBeNull();
    expect(getByText('No results')).toBeTruthy();
  });
});

describe('sorting', () => {
  test('default "Highest Discount" sort puts the biggest discount first', async () => {
    const { getByText, toJSON } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Show Results (3)'));
    const positions = titleOrder(toJSON(), ['Nike Air Max Sale', 'Acme Widget Deal', 'Buy One Get One']);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
  });

  test('"Newest" sorts by createdAt descending', async () => {
    const { getByText, toJSON } = await render(<SearchScreen />);
    // The sort box itself is labeled with the currently-selected option
    // ("Highest Discount" by default) — pressing it opens the dropdown.
    await fireEvent.press(getByText('Highest Discount'));
    await fireEvent.press(getByText('Newest'));
    await fireEvent.press(getByText('Show Results (3)'));

    const positions = titleOrder(toJSON(), ['Buy One Get One', 'Nike Air Max Sale', 'Acme Widget Deal']);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
  });

  test('"Expiring Soonest" sorts by expiresAt ascending', async () => {
    const { getByText, toJSON } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Highest Discount'));
    await fireEvent.press(getByText('Expiring Soonest'));
    await fireEvent.press(getByText('Show Results (3)'));

    const positions = titleOrder(toJSON(), ['Acme Widget Deal', 'Nike Air Max Sale', 'Buy One Get One']);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
  });
});

describe('results view', () => {
  test('an active category filter shows a removable "Showing: X" chip', async () => {
    const { getByText, getAllByText, queryByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Footwear'));
    await fireEvent.press(getByText('Show Results (1)'));

    expect(getByText('Showing:')).toBeTruthy();
    // "Footwear" now appears twice: the active-filter chip itself, and the
    // matching deal card's own category line — the chip renders first.
    const footwearMatches = getAllByText('Footwear');
    expect(footwearMatches.length).toBe(2);

    await fireEvent.press(footwearMatches[0]);
    // Clearing the active filter chip returns to the filter panel (query still empty).
    expect(queryByText('Showing:')).toBeNull();
    expect(getByText('Categories')).toBeTruthy();
  });

  test('pressing a deal card navigates to DealDetailScreen with a transitionTag', async () => {
    const { getByPlaceholderText, getByText } = await render(<SearchScreen />);
    await fireEvent.changeText(getByPlaceholderText('Search deals, brands, categories...'), 'Air Max');
    await fireEvent.press(getByText('View Deal'));
    expect(mockNavigate).toHaveBeenCalledWith('DealDetailScreen', { id: '1', transitionTag: 'search-1' });
  });

  test('arriving with a route.params.category jumps straight to filtered results', async () => {
    mockRouteParams = { category: 'Tech' };
    const { getByText, queryByText } = await render(<SearchScreen />);
    expect(queryByText('Categories')).toBeNull();
    expect(getByText('Acme Widget Deal')).toBeTruthy();
  });
});

describe('empty deals (nothing loaded yet)', () => {
  test('renders "No results" instead of crashing when there is no data', async () => {
    useDataStore.setState({ deals: [], categories: [], brandsById: {} });
    const { getByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Show Results (0)'));
    expect(getByText('No results')).toBeTruthy();
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
    useDataStore.setState({ deals: manyDeals, categories, brandsById });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('only renders the first page of results, not all of them at once', async () => {
    const { getByText, queryByText } = await render(<SearchScreen />);
    await fireEvent.press(getByText('Show Results (15)'));

    expect(getByText('Deal Number 0')).toBeTruthy();
    expect(queryByText('Deal Number 14')).toBeNull();
  });
});
