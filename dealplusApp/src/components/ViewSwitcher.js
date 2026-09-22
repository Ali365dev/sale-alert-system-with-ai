import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SHADOWS } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import { GridViewIcon, ListViewIcon } from './ViewSwitcherIcons';

const BTN_W = 32;
const BTN_H = 28;
const PAD = 3;
const GAP = 2;
const SPRING = { damping: 16, stiffness: 280, mass: 0.65 };

/** List / grid control with a sliding highlight and press-scale, used on Home and Coupons. */
const ViewSwitcher = ({ gridView, onChange }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = useSharedValue(gridView ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(gridView ? 1 : 0, SPRING);
  }, [gridView, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (BTN_W + GAP) }],
  }));

  const listIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1.08, 0.92]) }],
  }));

  const gridIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.92, 1.08]) }],
  }));

  const onPressIn = () => {
    press.value = withSpring(0.94, { damping: 18, stiffness: 360, mass: 0.5 });
  };
  const onPressOut = () => {
    press.value = withSpring(1, SPRING);
  };

  return (
    <Animated.View style={[styles.track, trackStyle]} accessibilityRole="tablist">
      <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" />
      <Pressable
        style={styles.btn}
        onPress={() => onChange(false)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="tab"
        accessibilityState={{ selected: !gridView }}
        accessibilityLabel="List view">
        <Animated.View style={[styles.iconBox, listIconStyle]}>
          <ListViewIcon color={!gridView ? colors.accent : colors.mutedInk} size={16} />
        </Animated.View>
      </Pressable>
      <Pressable
        style={styles.btn}
        onPress={() => onChange(true)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="tab"
        accessibilityState={{ selected: gridView }}
        accessibilityLabel="Grid view">
        <Animated.View style={[styles.iconBox, gridIconStyle]}>
          <GridViewIcon color={gridView ? colors.accent : colors.mutedInk} size={16} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

export default ViewSwitcher;

const createStyles = (colors) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 999,
      padding: PAD,
      gap: GAP,
      flexShrink: 0,
      overflow: 'hidden',
      ...SHADOWS.card,
    },
    thumb: {
      position: 'absolute',
      top: PAD,
      left: PAD,
      width: BTN_W,
      height: BTN_H,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    btn: {
      width: BTN_W,
      height: BTN_H,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      overflow: 'hidden',
    },
    iconBox: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
