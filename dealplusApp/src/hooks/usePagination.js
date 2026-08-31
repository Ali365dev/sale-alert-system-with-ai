import { useEffect, useRef, useState } from 'react';

const DEFAULT_PAGE_SIZE = 10;
// Data is already fully loaded client-side, so revealing the next page is
// instant — this small delay is purely so the loading indicator is visible
// for a beat (otherwise it'd flash for a single frame) and so rapid scroll
// events near the bottom can't fire loadMore faster than the UI can react.
const LOAD_DELAY_MS = 400;

/** Reveals `items` a page at a time instead of rendering the whole (already
 * client-side-loaded) list at once — resets back to the first page whenever
 * the underlying list itself changes (new filter, search, sort, or refresh). */
export const usePagination = (items, pageSize = DEFAULT_PAGE_SIZE) => {
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const timerRef = useRef(null);
  // A plain ref, not the isLoadingMore state, guards against re-entrant
  // calls — a burst of scroll events can fire loadMore several times
  // before React re-renders with the updated state, and each of those
  // calls would otherwise still see the stale (pre-update) isLoadingMore
  // and slip through, scheduling multiple page advances at once.
  const loadingRef = useRef(false);

  useEffect(() => {
    setPage(1);
    setIsLoadingMore(false);
    loadingRef.current = false;
    clearTimeout(timerRef.current);
  }, [items]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const visibleItems = items.slice(0, page * pageSize);
  const hasMore = visibleItems.length < items.length;
  const remaining = items.length - visibleItems.length;

  const loadMore = () => {
    if (!hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    timerRef.current = setTimeout(() => {
      setPage((p) => p + 1);
      setIsLoadingMore(false);
      loadingRef.current = false;
    }, LOAD_DELAY_MS);
  };

  return { visibleItems, hasMore, remaining, isLoadingMore, loadMore };
};
