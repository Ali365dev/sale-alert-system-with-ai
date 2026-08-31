import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { staggerDelay } from '../utils/stagger';

/** Staggered fade-in: each item fades (with a slight rise) a beat after the one before it, capped so long lists don't feel sluggish. */
const AnimatedListItem = ({ index, children, style }) => {
  const delay = staggerDelay(index);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic))} style={style}>
      {children}
    </Animated.View>
  );
};

export default AnimatedListItem;
