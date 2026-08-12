import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';

/** expo-image wrapped for reanimated so it can carry a sharedTransitionTag across screens. */
export const AnimatedImage = Animated.createAnimatedComponent(Image);

export function dealImageTag(dealId: string): string {
  return `deal-image-${dealId}`;
}
