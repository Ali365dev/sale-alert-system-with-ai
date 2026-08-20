import Animated, { FadeInDown } from 'react-native-reanimated';

const STAGGER_STEP_MS = 55;
const MAX_STAGGER_INDEX = 8;

/** Fade + slide-up entrance, staggered by list position (capped so long lists don't feel sluggish). */
const AnimatedListItem = ({ index, children, style }) => {
  const delay = Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP_MS;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(360).springify().damping(17).mass(0.6)} style={style}>
      {children}
    </Animated.View>
  );
};

export default AnimatedListItem;
