import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

interface Props {
  active: boolean;
  onPress: () => void;
  size?: number;
  hitSlop?: number;
}

/** Heart toggle with a spring "pop" whenever it's saved, matching the bounce iOS favorite controls use. */
export function FavoriteButton({ active, onPress, size = 20, hitSlop = 8 }: Props) {
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.value = withSequence(
      withTiming(0.7, { duration: 90 }),
      // withSpring(1.25, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 10, stiffness: 300 })
    );
  }, [active, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable hitSlop={hitSlop} onPress={onPress}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={active ? 'heart' : 'heart-outline'} size={size} color={active ? '#B7131A' : '#171717'} />
      </Animated.View>
    </Pressable>
  );
}
