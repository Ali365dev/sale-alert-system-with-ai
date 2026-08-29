import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../hooks/useTheme';

/** Heart toggle with a spring "pop" whenever it's saved, matching the bounce iOS favorite controls use. */
const FavoriteButton = ({ active, onPress, size = 20, hitSlop = 8 }) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, { damping: 10, stiffness: 300 }));
  }, [active, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable hitSlop={hitSlop} onPress={onPress}>
      <Animated.View style={animatedStyle}>
        <Icon name={active ? 'heart' : 'heart-outline'} size={size} color={active ? colors.primary : colors.text} />
      </Animated.View>
    </Pressable>
  );
};

export default FavoriteButton;
