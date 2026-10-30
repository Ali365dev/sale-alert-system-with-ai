/**
 * Performance regression tests for usePagination.
 *
 * The bug this guards against: every deal/brand list screen used to
 * `.map()` the entire (already client-side-loaded) array straight into the
 * view tree — hundreds of DealCards mounting, animating, and laying out at
 * once. usePagination is what keeps that bounded; these tests fail loudly
 * if a future change makes it render (or reveal) more than one page again.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { usePagination } from '../usePagination';

function Harness({ items, pageSize, onState }) {
  const state = usePagination(items, pageSize);
  onState(state);
  return null;
}

const renderHarness = (items, pageSize) => {
  let latest;
  let tree;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Harness items={items} pageSize={pageSize} onState={(s) => (latest = s)} />);
  });
  return {
    get state() {
      return latest;
    },
    update: (nextItems) => {
      ReactTestRenderer.act(() => {
        tree.update(<Harness items={nextItems} pageSize={pageSize} onState={(s) => (latest = s)} />);
      });
    },
  };
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('only reveals the first page of a large list, never the whole array', () => {
  const items = Array.from({ length: 500 }, (_, i) => i);
  const { state } = renderHarness(items, 10);

  expect(state.visibleItems).toHaveLength(10);
  expect(state.hasMore).toBe(true);
  expect(state.remaining).toBe(490);
});

test('a list smaller than one page renders in full and reports no more pages', () => {
  const items = Array.from({ length: 4 }, (_, i) => i);
  const { state } = renderHarness(items, 10);

  expect(state.visibleItems).toHaveLength(4);
  expect(state.hasMore).toBe(false);
});

test('loadMore does not reveal the next page synchronously (only after the load finishes)', () => {
  const items = Array.from({ length: 500 }, (_, i) => i);
  const harness = renderHarness(items, 10);

  ReactTestRenderer.act(() => {
    harness.state.loadMore();
  });

  expect(harness.state.isLoadingMore).toBe(true);
  expect(harness.state.visibleItems).toHaveLength(10); // still just page 1 while "loading"

  ReactTestRenderer.act(() => {
    jest.runAllTimers();
  });

  expect(harness.state.isLoadingMore).toBe(false);
  expect(harness.state.visibleItems).toHaveLength(20);
});

test('a second loadMore call is ignored while the first is still in flight', () => {
  const items = Array.from({ length: 500 }, (_, i) => i);
  const harness = renderHarness(items, 10);

  ReactTestRenderer.act(() => {
    harness.state.loadMore();
    harness.state.loadMore();
    harness.state.loadMore();
  });
  ReactTestRenderer.act(() => {
    jest.runAllTimers();
  });

  // Guards against a burst of scroll events near the bottom each firing
  // their own loadMore and skipping several pages in one go.
  expect(harness.state.visibleItems).toHaveLength(20);
});

test('resets back to page 1 when the underlying list changes (new filter/search/refresh)', () => {
  const listA = Array.from({ length: 500 }, (_, i) => i);
  const harness = renderHarness(listA, 10);

  ReactTestRenderer.act(() => {
    harness.state.loadMore();
  });
  ReactTestRenderer.act(() => {
    jest.runAllTimers();
  });
  expect(harness.state.visibleItems).toHaveLength(20);

  const listB = Array.from({ length: 30 }, (_, i) => i + 10_000);
  harness.update(listB);

  // A smaller, unrelated list must not inherit the previous page count —
  // otherwise a narrower filter could still render more items than exist.
  expect(harness.state.visibleItems).toHaveLength(10);
  expect(harness.state.hasMore).toBe(true);
});
