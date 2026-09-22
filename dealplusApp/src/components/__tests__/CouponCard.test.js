import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CouponCard from '../CouponCard';

jest.mock('../../utils/CustomToast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

const deal = {
  id: 'deal-1',
  brandId: 'jahez',
  title: 'Delivery of restaurant orders, gifts and more',
  discountLabel: '10%',
  isPercentageOff: true,
  promoCode: 'JAHEZ10',
};

const brand = {
  name: 'Jahez',
  initials: 'J',
  logoUrl: null,
  description: 'Delivery of restaurant orders, gifts and more',
};

test('vertical ticket shows brand, percent, Discount badge, and description', async () => {
  const { getByText } = await render(
    <CouponCard deal={deal} brand={brand} variant="vertical" onPress={() => {}} />,
  );

  expect(getByText('Jahez')).toBeTruthy();
  expect(getByText('10%')).toBeTruthy();
  expect(getByText('Discount')).toBeTruthy();
  expect(getByText('Delivery of restaurant orders, gifts and more')).toBeTruthy();
});

test('pressing the vertical ticket calls onPress', async () => {
  const onPress = jest.fn();
  const { getByLabelText } = await render(
    <CouponCard deal={deal} brand={brand} variant="vertical" onPress={onPress} />,
  );

  await fireEvent.press(getByLabelText('Jahez 10% discount'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('horizontal ticket shows brand, description, percent, Discount, and Copy', async () => {
  const { getByText } = await render(
    <CouponCard deal={deal} brand={brand} variant="horizontal" onPress={() => {}} />,
  );

  expect(getByText('Jahez')).toBeTruthy();
  expect(getByText('Delivery of restaurant orders, gifts and more')).toBeTruthy();
  expect(getByText('10%')).toBeTruthy();
  expect(getByText('Discount')).toBeTruthy();
  expect(getByText('Copy')).toBeTruthy();
});

test('horizontal ticket shows View when there is no promo code', async () => {
  const { getByText, queryByText } = await render(
    <CouponCard
      deal={{ ...deal, promoCode: null }}
      brand={brand}
      variant="horizontal"
      onPress={() => {}}
    />,
  );

  expect(getByText('View')).toBeTruthy();
  expect(queryByText('Copy')).toBeNull();
});

test('vertical ticket shows non-percent types like Loyalty smaller than percents', async () => {
  const { getByText } = await render(
    <CouponCard
      deal={{ ...deal, isPercentageOff: false, discountLabel: 'LOYALTY' }}
      brand={brand}
      variant="vertical"
      onPress={() => {}}
    />,
  );

  const label = getByText('LOYALTY');
  expect(label).toBeTruthy();
  expect(label.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ fontSize: 14 })]),
  );
});
