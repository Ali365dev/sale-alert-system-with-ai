import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PAGE_SIZE = 10;
// Data is already fully loaded client-side, so revealing the next page is
// instant — this small delay is purely so the loading indicator is visible
// for a beat (otherwise it'd flash for a single frame) and so rapid scroll
// events near the bottom can't fire loadMore faster than the UI can react.
const LOAD_DELAY_MS = 450;

/** Stable identity for a list so filter/search resets pagination, but a new
 * array reference with the same items does not wipe the current page. */
const listIdentity = (items) => {
  const list = items || [];
  if (!list.length) return '0';
  const first = list[0];
  const last = list[list.length - 1];
  return `${list.length}:${String(first?.id ?? first)}:${String(last?.id ?? last)}`;
};

/** Reveals `items` a page at a time instead of rendering the whole (already
 * client-side-loaded) list at once — resets back to the first page whenever
 * the underlying list itself changes (new filter, search, sort, or refresh). */
export const usePagination = (items, pageSize = DEFAULT_PAGE_SIZE) => {
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const timerRef = useRef(null);
  // A plain ref, not the isLoadingMore state, guards against re-entrant
  // calls — a burst of scroll events near the bottom can fire loadMore several times
  // before React re-renders with the updated state.
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(false);
  const identityRef = useRef(listIdentity(items));

  const list = items || [];
  const identity = listIdentity(list);
  const visibleItems = list.slice(0, page * pageSize);
  const hasMore = visibleItems.length < list.length;
  const remaining = list.length - visibleItems.length;
  hasMoreRef.current = hasMore;

  useEffect(() => {
    if (identity === identityRef.current) return;
    identityRef.current = identity;
    setPage(1);
    setIsLoadingMore(false);
    loadingRef.current = false;
    clearTimeout(timerRef.current);
  }, [identity]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    timerRef.current = setTimeout(() => {
      setPage((p) => p + 1);
      setIsLoadingMore(false);
      loadingRef.current = false;
    }, LOAD_DELAY_MS);
  }, []);

  return { visibleItems, hasMore, remaining, isLoadingMore, loadMore };
};
