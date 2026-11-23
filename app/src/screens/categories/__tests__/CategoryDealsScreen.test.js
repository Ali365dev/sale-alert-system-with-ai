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

test('shows the category title, coupon card, sort chips, search, and view switcher — no filter icon or category chips', async () => {
  const { getByText, getByLabelText, queryByText, queryByLabelText } = await render(<CategoryDealsScreen />);
  expect(getByText('Fashion')).toBeTruthy();
  expect(queryByLabelText('Filter deals')).toBeNull();
  expect(getByText('40%')).toBeTruthy();
  expect(getByText('On jackets and more')).toBeTruthy();
  expect(getByLabelText('Sort deals')).toBeTruthy();
  expect(getByText('Top discount')).toBeTruthy();
  expect(getByText('Newest')).toBeTruthy();
  expect(getByText('Ending soon')).toBeTruthy();
  expect(getByLabelText('Search deals')).toBeTruthy();
  expect(getByLabelText('List view')).toBeTruthy();
  expect(getByLabelText('Grid view')).toBeTruthy();
  // Horizontal category chips removed
  expect(queryByText('Beauty & Personal Care')).toBeNull();
  expect(queryByText('Electronics')).toBeNull();
});

test('tapping an offer card opens deal detail', async () => {
  const { getByLabelText } = await render(<CategoryDealsScreen />);
  await fireEvent.press(getByLabelText('Acme 40% discount'));
  expect(mockNavigate).toHaveBeenCalledWith('DealDetailScreen', expect.objectContaining({ id: 'd1' }));
});

test('grid toggle switches the view without leaving the screen', async () => {
  const { getByLabelText, getByText } = await render(<CategoryDealsScreen />);
  await fireEvent.press(getByLabelText('Grid view'));
  expect(getByText('40%')).toBeTruthy();
});

test('sort chips reorder deals and expired offers sink to the bottom', async () => {
  useDataStore.setState({
    deals: [
      { ...deals[0], id: 'old', title: 'Expired mega sale', discountLabel: '-70%', expiresAt: '2020-01-01T00:00:00Z' },
      deals[0],
      { ...deals[2], expiresAt: '2027-01-01T00:00:00Z' },
    ],
  });
  const { getAllByText, getByText } = await render(<CategoryDealsScreen />);
  const titles = () => getAllByText(/jackets|clearance|mega sale/).map((n) => n.props.children);
  expect(titles()).toEqual(['On jackets and more', 'In-store clearance', 'Expired mega sale']);
  await fireEvent.press(getByText('Ending soon'));
  expect(titles()).toEqual(['In-store clearance', 'On jackets and more', 'Expired mega sale']);
});
