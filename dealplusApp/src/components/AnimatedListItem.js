import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

const STAGGER_STEP_MS = 150;
const MAX_STAGGER_INDEX = 10;

/** Staggered fade-in: each item fades (with a slight rise) a beat after the one before it, capped so long lists don't feel sluggish. */
const AnimatedListItem = ({ index, children, style }) => {
  const delay = Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP_MS;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic))} style={style}>
      {children}
    </Animated.View>
  );
};

export default AnimatedListItem;
