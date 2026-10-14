/** True once a ScrollView's onScroll nativeEvent is within `threshold` px of
 * the bottom — used to auto-load the next page instead of a "Load More" tap. */
export const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }, threshold = 160) => {
  const viewport = layoutMeasurement?.height ?? 0;
  const offset = contentOffset?.y ?? 0;
  const content = contentSize?.height ?? 0;
  if (viewport <= 0 || content <= 0) return false;
  // Short lists that don't fill the screen still count as "at bottom".
  if (content <= viewport + threshold) return true;
  return viewport + offset >= content - threshold;
};
