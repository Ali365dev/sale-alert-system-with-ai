import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export const usePressScale = (pressedScale = 0.96) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(pressedScale, { damping: 18, stiffness: 260 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 260 });
  };

  return { animatedStyle, onPressIn, onPressOut, scale };
};
