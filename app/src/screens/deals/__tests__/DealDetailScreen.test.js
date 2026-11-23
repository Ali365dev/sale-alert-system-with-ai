const mockNavigate = jest.fn();
let mockParams = { id: 'd1' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ name: 'DealDetailScreen', params: mockParams }),
  // authGate pulls in NavigationUtil, which builds a container ref at import time.
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
  CommonActions: { reset: jest.fn() },
}));

jest.mock('@d11/react-native-fast-image', () => {
  const { View } = require('react-native');
  const FastImage = (props) => <View {...props} />;
  FastImage.priority = { high: 'high' };
  FastImage.resizeMode = { cover: 'cover', contain: 'contain' };
  return FastImage;
});

jest.mock('../../../utils/CustomToast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import DealDetailScreen from '../DealDetailScreen';
import useDataStore from '../../../state/dataStore';

const baseDeal = {
  id: 'd1',
  brandId: 'acme',
  title: 'Up to 70% off the winter edit',
  description: 'Acme is running a mega sale on its entire stock.',
  highlights: ['Up to 70% off on entire stock', 'Available online and in stores'],
  discountLabel: '-70%',
  isPercentageOff: true,
  category: 'Fashion',
  channel: 'ONLINE',
  promoCode: null,
  website: 'https://acme.com',
  expiresAt: '',
  image: 'https://cdn.acme.com/winter.jpg',
  hasOwnImage: true,
};

const setDeal = (overrides = {}) =>
  useDataStore.setState({
    deals: [{ ...baseDeal, ...overrides }],
    brandsById: { acme: { id: 'acme', name: 'Acme', initials: 'A' } },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: 'd1' };
  setDeal();
});

test('shows the offer image as a cover with discount and expiry pills', async () => {
  const { getByTestId, getByText, getByLabelText } = await render(<DealDetailScreen />);
  expect(getByTestId('deal-hero-image')).toBeTruthy();
  expect(getByLabelText('Promotional image from Acme')).toBeTruthy();
  expect(getByText('70% OFF')).toBeTruthy();
  expect(getByText('Ongoing offer')).toBeTruthy();
  expect(getByText('Up to 70% off the winter edit')).toBeTruthy();
  expect(getByText('Highlights')).toBeTruthy();
  expect(getByText('Up to 70% off on entire stock')).toBeTruthy();
});

test('falls back to a branded panel instead of a stock photo when the offer has no image', async () => {
  setDeal({ hasOwnImage: false, image: 'https://images.unsplash.com/stock.jpg' });
  const { getByTestId, queryByTestId } = await render(<DealDetailScreen />);
  expect(getByTestId('deal-hero-fallback')).toBeTruthy();
  expect(queryByTestId('deal-hero-image')).toBeNull();
});

test('tells the shopper no code is needed when the offer has none', async () => {
  const { getByText } = await render(<DealDetailScreen />);
  expect(getByText(/No code needed/)).toBeTruthy();
});

test('shows the coupon code when the offer has one', async () => {
  setDeal({ promoCode: 'WINTER70' });
  const { getByText, queryByText } = await render(<DealDetailScreen />);
  expect(getByText('WINTER70')).toBeTruthy();
  expect(queryByText(/No code needed/)).toBeNull();
});

test('shop button opens the store and the brand row opens the brand page', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const { getByText, getByLabelText } = await render(<DealDetailScreen />);
  await fireEvent.press(getByText('Shop at Acme'));
  expect(openURL).toHaveBeenCalledWith('https://acme.com');
  await fireEvent.press(getByLabelText('View Acme brand details'));
  expect(mockNavigate).toHaveBeenCalledWith('BrandDetailScreen', { id: 'acme' });
});

test('shows a not-found state for an unknown offer', async () => {
  mockParams = { id: 'missing' };
  const { getByText } = await render(<DealDetailScreen />);
  expect(getByText('Coupon not found')).toBeTruthy();
});
