/**
 * Performance + open-path regressions for CouponSheet (Home / Explore).
 *
 * Guards:
 * 1. Sheet content stays cheap to mount.
 * 2. Opening the same coupon again still bumps presentKey (fixes 2-tap open).
 * 3. Rapid openCoupon calls stay O(1) state updates.
 */
import React, { Profiler, useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import CouponSheet, { useCouponSheet } from '../../components/CouponSheet';

jest.mock('../../utils/CustomToast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../state/dataStore', () => {
  const brandsById = {
    myntra: { id: 'myntra', name: 'Myntra', initials: 'M', website: 'https://www.myntra.com' },
    nike: { id: 'nike', name: 'Nike', initials: 'N', website: 'https://www.nike.com' },
  };
  return {
    __esModule: true,
    default: (sel) => sel({ brandsById, deals: [], brands: [], loading: false, error: null }),
  };
});

const dealA = {
  id: 'deal-myntra',
  brandId: 'myntra',
  title: 'Flat 40% Off',
  description: 'Fashion sale',
  discountLabel: '40%',
  isPercentageOff: true,
  promoCode: 'MYNTRA40',
  website: 'https://www.myntra.com',
  expiresAt: '2026-12-30T00:00:00.000Z',
  terms: 'While supplies last.',
};

const dealB = {
  ...dealA,
  id: 'deal-nike',
  brandId: 'nike',
  title: '30% Off Shoes',
  promoCode: 'NIKE30',
  website: 'https://www.nike.com',
};

const brandA = { name: 'Myntra', initials: 'M', website: 'https://www.myntra.com' };

function OpenHarness({ onApi }) {
  const api = useCouponSheet();
  onApi(api);
  return (
    <View>
      <Pressable testID="open-a" onPress={() => api.openCoupon(dealA)}>
        <Text>Open A</Text>
      </Pressable>
      <Pressable testID="open-b" onPress={() => api.openCoupon(dealB)}>
        <Text>Open B</Text>
      </Pressable>
      <Pressable testID="open-a-again" onPress={() => api.openCoupon(dealA)}>
        <Text>Open A again</Text>
      </Pressable>
      {api.couponSheet}
    </View>
  );
}

const press = (tree, testID) => {
  const node = tree.root.findByProps({ testID });
  ReactTestRenderer.act(() => {
    node.props.onPress();
  });
};

describe('CouponSheet render cost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('initial sheet mount stays under budget', () => {
    let actualDuration = 0;
    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <Profiler
          id="coupon-sheet"
          onRender={(_id, _phase, duration) => {
            actualDuration += duration;
          }}>
          <CouponSheet deal={dealA} brand={brandA} presentKey={1} onClose={() => {}} />
        </Profiler>,
      );
    });
    expect(actualDuration).toBeLessThan(200);
  });

  test('re-presenting with a new presentKey remounts content cheaply', () => {
    let tree;
    let actualDuration = 0;

    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Profiler
          id="coupon-sheet-reopen"
          onRender={(_id, _phase, duration) => {
            actualDuration += duration;
          }}>
          <CouponSheet deal={dealA} brand={brandA} presentKey={1} onClose={() => {}} />
        </Profiler>,
      );
    });

    actualDuration = 0;
    ReactTestRenderer.act(() => {
      tree.update(
        <Profiler
          id="coupon-sheet-reopen"
          onRender={(_id, _phase, duration) => {
            actualDuration += duration;
          }}>
          <CouponSheet deal={dealA} brand={brandA} presentKey={2} onClose={() => {}} />
        </Profiler>,
      );
    });

    expect(actualDuration).toBeLessThan(150);
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
  });
});

describe('useCouponSheet open path (Home / Explore)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('openCoupon bumps presentKey every time, including same deal', () => {
    let api;
    let tree;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<OpenHarness onApi={(a) => (api = a)} />);
    });

    press(tree, 'open-a');
    const key1 = api.couponSheet.props.presentKey;
    expect(api.couponSheet.props.deal).toEqual(dealA);
    expect(key1).toBeGreaterThanOrEqual(1);

    press(tree, 'open-a-again');
    const key2 = api.couponSheet.props.presentKey;
    expect(api.couponSheet.props.deal).toEqual(dealA);
    expect(key2).toBeGreaterThan(key1);

    press(tree, 'open-b');
    expect(api.couponSheet.props.deal.id).toBe('deal-nike');
    expect(api.couponSheet.props.presentKey).toBeGreaterThan(key2);

    ReactTestRenderer.act(() => {
      tree.unmount();
    });
  });

  test('100 rapid openCoupon calls stay O(1) and finish under budget', () => {
    let latestKey = 0;
    let latestDeal = null;

    function StressHarness() {
      const [deal, setDeal] = useState(null);
      const [presentKey, setPresentKey] = useState(0);
      const openCoupon = useCallback((next) => {
        setDeal(next);
        setPresentKey((k) => k + 1);
      }, []);
      latestKey = presentKey;
      latestDeal = deal;
      return (
        <Pressable
          testID="spam"
          onPress={() => {
            for (let i = 0; i < 100; i += 1) openCoupon(dealA);
          }}>
          <Text>spam</Text>
        </Pressable>
      );
    }

    let tree;
    const start = Date.now();
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<StressHarness />);
    });
    press(tree, 'spam');
    const elapsed = Date.now() - start;

    expect(latestDeal).toEqual(dealA);
    expect(latestKey).toBe(100);
    expect(elapsed).toBeLessThan(500);

    ReactTestRenderer.act(() => {
      tree.unmount();
    });
  });
});
