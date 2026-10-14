/**
 * Performance regressions for Home + Explore (Coupons) list sections.
 *
 * Home mounts at most 20 coupon cards even when hundreds of deals exist.
 * Explore paginates client-side (page size 10) so FlatList never mounts
 * the full catalog on first paint.
 */
import React, { Profiler, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { usePagination } from '../../hooks/usePagination';

const HOME_COUPON_CAP = 20;
const EXPLORE_PAGE_SIZE = 10;

const makeDeals = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `deal-${i}`,
    brandId: `brand-${i % 20}`,
    title: `Offer ${i}`,
    discountLabel: '20%',
    isPercentageOff: true,
    promoCode: `CODE${i}`,
    channel: i % 2 === 0 ? 'ONLINE' : 'IN-STORE',
  }));

/** Mirrors HomeScreen popular-coupons slice. */
function HomeCouponList({ deals, onRenderItem }) {
  const visible = deals.slice(0, HOME_COUPON_CAP);
  return (
    <View>
      {visible.map((deal) => {
        onRenderItem?.(deal);
        return (
          <View key={deal.id} accessibilityLabel={`home-coupon-${deal.id}`}>
            <Text>{deal.title}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Mirrors CouponsScreen (Explore) pagination. */
function ExploreCouponList({ deals, onState }) {
  const { visibleItems, hasMore, isLoadingMore, loadMore } = usePagination(deals, EXPLORE_PAGE_SIZE);
  onState?.({ visibleItems, hasMore, isLoadingMore, loadMore });
  return (
    <View>
      {visibleItems.map((deal) => (
        <View key={deal.id} accessibilityLabel={`explore-coupon-${deal.id}`}>
          <Text>{deal.title}</Text>
        </View>
      ))}
    </View>
  );
}

const measureRender = (element) => {
  let actualDuration = 0;
  let commitCount = 0;
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <Profiler
        id="list"
        onRender={(_id, _phase, duration) => {
          actualDuration += duration;
          commitCount += 1;
        }}>
        {element}
      </Profiler>,
    );
  });
  return { actualDuration, commitCount };
};

describe('Home list performance', () => {
  test('caps first paint at 20 coupons even with 500 deals', () => {
    const deals = makeDeals(500);
    const renderedIds = [];

    const { actualDuration, commitCount } = measureRender(
      <HomeCouponList deals={deals} onRenderItem={(d) => renderedIds.push(d.id)} />,
    );

    expect(renderedIds).toHaveLength(HOME_COUPON_CAP);
    expect(renderedIds[0]).toBe('deal-0');
    expect(renderedIds[HOME_COUPON_CAP - 1]).toBe(`deal-${HOME_COUPON_CAP - 1}`);
    expect(commitCount).toBeGreaterThanOrEqual(1);
    // Soft budget — catches accidental full-list mounts (hundreds of ms in CI/Jest).
    expect(actualDuration).toBeLessThan(250);
  });

  test('Home slice is O(cap), not O(catalog)', () => {
    const small = makeDeals(20);
    const large = makeDeals(500);

    const smallMs = measureRender(<HomeCouponList deals={small} />).actualDuration;
    const largeMs = measureRender(<HomeCouponList deals={large} />).actualDuration;

    // 25× more deals must not be ~25× slower if we keep the 20-card cap.
    expect(largeMs).toBeLessThan(Math.max(smallMs * 4, 80));
  });
});

describe('Explore (Coupons) list performance', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('first page mounts only 10 of 500 deals', () => {
    const deals = makeDeals(500);
    let latest;

    const { actualDuration } = measureRender(
      <ExploreCouponList deals={deals} onState={(s) => (latest = s)} />,
    );

    expect(latest.visibleItems).toHaveLength(EXPLORE_PAGE_SIZE);
    expect(latest.hasMore).toBe(true);
    expect(actualDuration).toBeLessThan(250);
  });

  test('loadMore reveals one page at a time (no multi-page skip)', () => {
    const deals = makeDeals(500);
    let latest;
    let tree;

    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ExploreCouponList deals={deals} onState={(s) => (latest = s)} />,
      );
    });

    ReactTestRenderer.act(() => {
      latest.loadMore();
      latest.loadMore();
      latest.loadMore();
    });
    ReactTestRenderer.act(() => {
      jest.runAllTimers();
    });

    expect(latest.visibleItems).toHaveLength(EXPLORE_PAGE_SIZE * 2);
    expect(latest.isLoadingMore).toBe(false);

    // Second page load
    ReactTestRenderer.act(() => {
      latest.loadMore();
    });
    ReactTestRenderer.act(() => {
      jest.runAllTimers();
    });
    expect(latest.visibleItems).toHaveLength(EXPLORE_PAGE_SIZE * 3);

    ReactTestRenderer.act(() => {
      tree.unmount();
    });
  });

  test('filter change resets to page 1 (Explore chips)', () => {
    const all = makeDeals(80);
    const online = all.filter((d) => d.channel === 'ONLINE');
    let latest;
    let tree;

    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ExploreCouponList deals={all} onState={(s) => (latest = s)} />,
      );
    });

    ReactTestRenderer.act(() => {
      latest.loadMore();
    });
    ReactTestRenderer.act(() => {
      jest.runAllTimers();
    });
    expect(latest.visibleItems.length).toBe(20);

    ReactTestRenderer.act(() => {
      tree.update(<ExploreCouponList deals={online} onState={(s) => (latest = s)} />);
    });

    expect(latest.visibleItems).toHaveLength(Math.min(EXPLORE_PAGE_SIZE, online.length));
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
  });
});
