import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';
import useTheme from '../hooks/useTheme';
import { TabBarIcon } from './TabBarIcons';

/** Figma node 3:7 — Exact Bottom Navigation Bar */
const BAR_TOP_RADIUS = 24;
const INDICATOR_WIDTH = 48;
const INDICATOR_HEIGHT = 3.5;

function TabItem({ name, label, focused, onPress, onLayout, active, inactive }) {
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressScale(0.92);
  const tint = focused ? active : inactive;

  return (
    <View style={layoutStyles.itemWrap} onLayout={onLayout}>
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={focused ? { selected: true } : {}}
          style={layoutStyles.item}>
          <View style={layoutStyles.iconSlot}>
            <TabBarIcon name={name} color={tint} focused={focused} />
          </View>
          <Text style={[layoutStyles.label, { color: tint }]}>{label}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * Figma bottom bar: exact Home / Explore / Profile icons + top pill that
 * slides left↔right to the active tab.
 */
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const layoutsRef = useRef({});
  const [ready, setReady] = useState(false);
  const indicatorX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  const moveIndicatorTo = useCallback(
    (routeKey) => {
      const rect = layoutsRef.current[routeKey];
      if (!rect) return;
      const centerX = rect.x + rect.width / 2 - INDICATOR_WIDTH / 2;
      indicatorX.value = withTiming(centerX, { duration: 280, easing: Easing.out(Easing.cubic) });
      indicatorOpacity.value = withTiming(1, { duration: 180 });
    },
    [indicatorX, indicatorOpacity],
  );

  const handleItemLayout = (routeKey) => (event) => {
    const { x, width } = event.nativeEvent.layout;
    layoutsRef.current[routeKey] = { x, width };
    if (!ready && state.routes[state.index]?.key === routeKey) {
      const centerX = x + width / 2 - INDICATOR_WIDTH / 2;
      indicatorX.value = centerX;
      indicatorOpacity.value = 1;
      setReady(true);
    }
  };

  useEffect(() => {
    if (!ready) return;
    const active = state.routes[state.index];
    if (active) moveIndicatorTo(active.key);
  }, [ready, state.index, state.routes, moveIndicatorTo]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    opacity: indicatorOpacity.value,
  }));

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              name={route.name}
              label={label}
              focused={focused}
              onPress={onPress}
              onLayout={handleItemLayout(route.key)}
              active={colors.primary}
              inactive={colors.textSecondary}
            />
          );
        })}
      </View>
    </View>
  );
};

export default CustomTabBar;

const layoutStyles = StyleSheet.create({
  itemWrap: {
    flex: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingTop: 14,
    paddingBottom: SPACING.one,
  },
  iconSlot: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...TYPOGRAPHY.smallBold,
    fontSize: 12,
    fontWeight: '600',
  },
});

const createStyles = (colors) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: BAR_TOP_RADIUS,
      borderTopRightRadius: BAR_TOP_RADIUS,
      overflow: 'hidden',
      ...SHADOWS.raised,
    },
    bar: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      minHeight: 68,
      paddingTop: 0,
      paddingHorizontal: SPACING.two,
    },
    indicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: INDICATOR_WIDTH,
      height: INDICATOR_HEIGHT,
      borderRadius: INDICATOR_HEIGHT / 2,
      backgroundColor: colors.primary,
      zIndex: 2,
    },
  });
