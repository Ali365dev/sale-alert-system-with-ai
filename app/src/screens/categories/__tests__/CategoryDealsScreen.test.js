const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { category: 'Fashion' } }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CategoryDealsScreen from '../CategoryDealsScreen';
import useDataStore from '../../../state/dataStore';

const deals = [
  {
    id: 'd1',
    brandId: 'acme',
    title: 'On jackets and more',
    discountLabel: '-40%',
    isPercentageOff: true,
    category: 'Fashion',
    channel: 'ONLINE',
    promoCode: 'SAVE40',
    website: 'https://acme.com',
    expiresAt: '2027-05-25T00:00:00Z',
  },
  {
    id: 'd2',
    brandId: 'techco',
    title: 'On laptops',
    discountLabel: '-20%',
    isPercentageOff: true,
    category: 'Electronics',
    channel: 'ONLINE',
    promoCode: null,
    website: null,
    expiresAt: '2027-06-01T00:00:00Z',
  },
  {
    id: 'd3',
    brandId: 'acme',
    title: 'In-store clearance',
    discountLabel: '-30%',
    isPercentageOff: true,
    category: 'Fashion',
    channel: 'IN-STORE',
    promoCode: null,
    website: null,
    expiresAt: '2027-07-01T00:00:00Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  useDataStore.setState({
    deals,
    categories: [
      { name: 'Fashion', dealCount: 2 },
      { name: 'Electronics', dealCount: 1 },
    ],
    brandsById: {
      acme: { name: 'Acme', initials: 'A' },
      techco: { name: 'TechCo', initials: 'T' },
    },
    brands: [],
    alerts: [],
    loading: false,
    error: null,
  });
});

test('shows the category title, offer card, Sort, filter icon, and view switcher — without category chips', async () => {
  const { getByText, getByLabelText, queryByText } = await render(<CategoryDealsScreen />);
  expect(getByText('Fashion')).toBeTruthy();
  expect(getByText('Flat 40% Off')).toBeTruthy();
  expect(getByText('On jackets and more')).toBeTruthy();
  expect(getByText('Sort')).toBeTruthy();
  expect(getByLabelText('Filter deals')).toBeTruthy();
  expect(getByLabelText('Search deals')).toBeTruthy();
  expect(getByLabelText('List view')).toBeTruthy();
  expect(getByLabelText('Grid view')).toBeTruthy();
  // Horizontal category chips removed
  expect(queryByText('Beauty & Personal Care')).toBeNull();
  expect(queryByText('Electronics')).toBeNull();
});

test('filter icon opens the filter sheet; selecting Online keeps only online fashion deals', async () => {
  const { getByLabelText, getByText, queryByText } = await render(<CategoryDealsScreen />);
  await fireEvent.press(getByLabelText('Filter deals'));
  expect(getByText('Filter')).toBeTruthy();
  expect(getByText('Show deals by channel')).toBeTruthy();
  await fireEvent.press(getByLabelText('Filter Online'));
  expect(getByText('Flat 40% Off')).toBeTruthy();
  expect(queryByText('In-store clearance')).toBeNull();
});

test('tapping an offer card opens deal detail', async () => {
  const { getByText } = await render(<CategoryDealsScreen />);
  await fireEvent.press(getByText('Flat 40% Off'));
  expect(mockNavigate).toHaveBeenCalledWith('DealDetailScreen', expect.objectContaining({ id: 'd1' }));
});

test('grid toggle switches the view without leaving the screen', async () => {
  const { getByLabelText, getByText } = await render(<CategoryDealsScreen />);
  await fireEvent.press(getByLabelText('Grid view'));
  expect(getByText('Flat 40% Off')).toBeTruthy();
});
