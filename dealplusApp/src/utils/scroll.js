/** True once a ScrollView's onScroll nativeEvent is within `threshold` px of
 * the bottom — used to auto-load the next page instead of a "Load More" tap. */
export const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }, threshold = 150) => {
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
};
