import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CouponSheet from '../CouponSheet';

jest.mock('../../utils/CustomToast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

const deal = {
  id: 'deal-myntra',
  brandId: 'myntra',
  title: 'Flat 40% Off + Extra 10% Cashback',
  description: 'Get flat 40% off on selected fashion products.',
  discountLabel: '40%',
  isPercentageOff: true,
  promoCode: 'MYNTRA40',
  website: 'https://www.myntra.com',
  expiresAt: '2025-05-30T00:00:00.000Z',
};

const brand = {
  name: 'Myntra',
  initials: 'M',
  website: 'https://www.myntra.com',
};

test('renders coupon details, code, how-to steps, and Shop Now', async () => {
  const { getByText, getByLabelText } = await render(
    <CouponSheet deal={deal} brand={brand} onClose={() => {}} />,
  );

  expect(getByText('Coupon Details')).toBeTruthy();
  expect(getByText('Flat 40% Off + Extra 10% Cashback')).toBeTruthy();
  expect(getByText('Online')).toBeTruthy();
  expect(getByText('MYNTRA40')).toBeTruthy();
  expect(getByText('Copy')).toBeTruthy();
  expect(getByText('About this offer')).toBeTruthy();
  expect(getByText('How to use')).toBeTruthy();
  expect(getByText('Shop Now')).toBeTruthy();
  expect(getByLabelText('Close coupon')).toBeTruthy();
});

test('back control calls onClose', async () => {
  const onClose = jest.fn();
  const { getByLabelText } = await render(<CouponSheet deal={deal} brand={brand} onClose={onClose} />);

  await fireEvent.press(getByLabelText('Close coupon'));
  expect(onClose).toHaveBeenCalled();
});
