const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { id: 'cat-footwear' } }),
}));

jest.mock('../../../utils/CustomToast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import BrandDetailScreen from '../BrandDetailScreen';
import useDataStore from '../../../state/dataStore';
import usePreferencesStore from '../../../state/preferencesStore';

const brand = {
  id: 'cat-footwear',
  name: 'Cat Footwear',
  initials: 'CF',
  logoUrl: null,
  website: 'https://www.catfootwear.com/en/home',
  description: 'Tracked offers from Cat Footwear.',
  dealCount: 2,
  coverImage: null,
};

const deals = [
  {
    id: 'd1',
    brandId: 'cat-footwear',
    title: 'Fall haul',
    discountLabel: '20%',
    isPercentageOff: true,
    promoCode: 'FALLHAUL',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
  useDataStore.setState({
    brands: [brand],
    deals,
    brandsById: { 'cat-footwear': brand },
    categories: [],
    alerts: [],
    loading: false,
    error: null,
  });
  usePreferencesStore.setState({ followedBrands: [], favoriteCategories: [] });
});

test('shows the overlapping store card, available coupons, and home coupon ticket', async () => {
  const { getByText, getByLabelText, getAllByText } = await render(<BrandDetailScreen />);
  expect(getAllByText('Cat Footwear').length).toBeGreaterThan(0);
  expect(getByText('Available Coupons')).toBeTruthy();
  expect(getByText('20%')).toBeTruthy();
  expect(getByText('Copy')).toBeTruthy();
  expect(getByText('Shop Now at Cat Footwear')).toBeTruthy();
  expect(getByLabelText('List view')).toBeTruthy();
  expect(getByLabelText('Grid view')).toBeTruthy();
});

test('Shop Now opens the brand website', async () => {
  const { getByText } = await render(<BrandDetailScreen />);
  await fireEvent.press(getByText('Shop Now at Cat Footwear'));
  expect(Linking.openURL).toHaveBeenCalledWith('https://www.catfootwear.com/en/home');
});
