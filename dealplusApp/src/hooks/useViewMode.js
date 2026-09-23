import { useCallback, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VIEW_MODE_ANIM = {
  duration: 280,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

/**
 * Shared list/grid mode state with a layout animation on toggle —
 * keep Home, Coupons, Brand Detail, Category Deals, and Favorites in sync.
 */
export default function useViewMode(initialGrid = false) {
  const [gridView, setGridView] = useState(initialGrid);

  const onChange = useCallback((next) => {
    LayoutAnimation.configureNext(VIEW_MODE_ANIM);
    setGridView(Boolean(next));
  }, []);

  return [gridView, onChange];
}
