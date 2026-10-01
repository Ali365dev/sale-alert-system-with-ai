import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DealCard from '../DealCard';
import useFavoritesStore from '../../state/favoritesStore';

jest.mock('../../utils/CustomToast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

const baseDeal = {
  id: 'deal-1',
  brandId: 'acme',
  title: 'Summer Sale',
  description: '50% off everything',
  discountLabel: '-50%',
  isPercentageOff: true,
  category: 'Fashion',
  promoCode: 'SAVE50',
  website: 'https://example.com',
};

const brand = { name: 'Acme Corp', initials: 'AC', logoUrl: null };

test('renders Figma-style promo title, code line, and Copy', async () => {
  const { getByText } = await render(<DealCard deal={baseDeal} brand={brand} onPress={() => {}} />);
  expect(getByText('Acme Corp Promo')).toBeTruthy();
  expect(getByText('Use code: SAVE50')).toBeTruthy();
  expect(getByText('Copy')).toBeTruthy();
});

test('falls back to Store Promo when brand is missing', async () => {
  const { getByText } = await render(<DealCard deal={baseDeal} brand={undefined} onPress={() => {}} />);
  expect(getByText('Store Promo')).toBeTruthy();
});

test('shows View when there is no promo code', async () => {
  const { getByText, queryByText } = await render(
    <DealCard deal={{ ...baseDeal, promoCode: null }} brand={brand} onPress={() => {}} />,
  );
  expect(getByText('View')).toBeTruthy();
  expect(queryByText('Copy')).toBeNull();
});

test('pressing the card body calls onPress', async () => {
  const onPress = jest.fn();
  const { getByText } = await render(<DealCard deal={baseDeal} brand={brand} onPress={onPress} />);
  await fireEvent.press(getByText('Acme Corp Promo'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('showUnfavorite removes the deal from favorites', async () => {
  useFavoritesStore.setState({ favoriteIds: ['deal-1'] });
  const { getByLabelText } = await render(
    <DealCard deal={baseDeal} brand={brand} showUnfavorite onPress={() => {}} />,
  );
  await fireEvent.press(getByLabelText('Remove from favorites'));
  expect(useFavoritesStore.getState().favoriteIds).toEqual([]);
});

test('offer variant shows the Figma headline, subtitle, channel, and heart', async () => {
  const { getByText, getAllByLabelText } = await render(
    <DealCard
      variant="offer"
      deal={{ ...baseDeal, expiresAt: '2027-05-25T12:00:00Z' }}
      brand={brand}
      onPress={() => {}}
    />,
  );
  expect(getByText('Flat 50% Off')).toBeTruthy();
  expect(getByText('Summer Sale')).toBeTruthy();
  expect(getByText('Online')).toBeTruthy();
  expect(getByText('Exp: 25 May 2027')).toBeTruthy();
  expect(getAllByLabelText('Add to favorites').length).toBeGreaterThan(0);
});
