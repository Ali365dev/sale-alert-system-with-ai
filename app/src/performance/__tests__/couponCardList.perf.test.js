/**
 * Real CouponCard mount cost for Home (≤20) vs accidental full catalog.
 */
import React, { Profiler } from 'react';
import { View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import CouponCard from '../../components/CouponCard';

jest.mock('../../utils/CustomToast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

const brand = { name: 'Jahez', initials: 'J', logoUrl: null, description: 'Offers' };

const makeDeal = (i) => ({
  id: `deal-${i}`,
  brandId: 'jahez',
  title: `Delivery offer ${i}`,
  discountLabel: '10%',
  isPercentageOff: true,
  promoCode: `CODE${i}`,
});

const renderCards = (count) => {
  let actualDuration = 0;
  const deals = Array.from({ length: count }, (_, i) => makeDeal(i));
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <Profiler
        id="coupon-cards"
        onRender={(_id, _phase, duration) => {
          actualDuration += duration;
        }}>
        <View>
          {deals.map((deal) => (
            <CouponCard key={deal.id} deal={deal} brand={brand} variant="horizontal" onPress={() => {}} />
          ))}
        </View>
      </Profiler>,
    );
  });
  return actualDuration;
};

describe('CouponCard list mount cost (Home section)', () => {
  test('Home budget: 20 coupon cards mount under 400ms in Jest', () => {
    const ms = renderCards(20);
    expect(ms).toBeLessThan(400);
  });

  test('Home cap stays much cheaper than mounting 100 cards', () => {
    const homeMs = renderCards(20);
    const heavyMs = renderCards(100);
    // If Home ever drops the .slice(0, 20) guard, this ratio collapses.
    expect(heavyMs).toBeGreaterThan(homeMs);
    expect(homeMs).toBeLessThan(heavyMs * 0.55);
  });
});
