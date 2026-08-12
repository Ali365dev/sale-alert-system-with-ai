import { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Radius } from '@/constants/theme';

interface Props {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Pulsing gray bone used to shape loading placeholders before real content fades in. */
export function Skeleton({ width, height = 14, radius = Radius.button, style }: Props) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.bone, { width, height, borderRadius: radius }, animatedStyle, style]}
    />
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: '#E8E8E8',
  },
});
