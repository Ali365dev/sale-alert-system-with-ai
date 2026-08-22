import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';

const ICONS = {
  Home: 'home-variant-outline',
  Search: 'magnify',
  Favorites: 'heart-outline',
  Profile: 'account-outline',
};

const CENTER_ROUTE = 'Deals';
const CENTER_ICON = 'tag-outline';
const INDICATOR_HEIGHT = 36;
const ITEM_LAYOUT = LinearTransition.duration(260).easing(Easing.out(Easing.cubic));

function TabItem({ name, label, focused, onPress, onLayout }) {
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressScale(0.92);

  return (
    <View onLayout={onLayout}>
      <Animated.View layout={ITEM_LAYOUT} style={pressStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={focused ? { selected: true } : {}}
          style={[styles.item, focused && styles.itemFocused]}>
          <Icon name={ICONS[name]} size={20} color="#FFFFFF" />
          <Text style={styles.label}>{label}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function CenterTabItem({ label, onPress }) {
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressScale(0.9);

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} hitSlop={8} accessibilityRole="button" style={styles.centerItem}>
      <Animated.View style={[styles.centerCircle, pressStyle]}>
        <Icon name={CENTER_ICON} size={24} color="#FFFFFF" />
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

/** Black floating tab bar with a raised center "Deals" button, matching the DealPulse mock. A
 * single red pill slides left-to-right (or right-to-left) beneath whichever regular tab is
 * focused — measured from each item's actual on-screen rect, so it travels smoothly between
 * e.g. Home and Search instead of each tab independently flashing its own highlight. The center
 * tab always renders as a bigger red circle poking above the bar, unaffected by the indicator. */
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const centerIndex = state.routes.findIndex((r) => r.name === CENTER_ROUTE);
  const leftRoutes = state.routes.slice(0, centerIndex).map((route, index) => ({ route, index }));
  const rightRoutes = state.routes.slice(centerIndex + 1).map((route, index) => ({ route, index: centerIndex + 1 + index }));
  const centerRoute = state.routes[centerIndex];

  const layoutsRef = useRef({});
  const rightGroupOffsetRef = useRef(0);
  const [ready, setReady] = useState(false);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const moveIndicatorTo = useCallback(
    (routeKey) => {
      const rect = layoutsRef.current[routeKey];
      if (!rect) return;
      indicatorX.value = withTiming(rect.x, { duration: 260, easing: Easing.out(Easing.cubic) });
      indicatorWidth.value = withTiming(rect.width, { duration: 260, easing: Easing.out(Easing.cubic) });
    },
    [indicatorX, indicatorWidth],
  );

  const handleItemLayout = (route, isRightGroup) => (event) => {
    const { x, width } = event.nativeEvent.layout;
    const absoluteX = isRightGroup ? rightGroupOffsetRef.current + x : x;
    layoutsRef.current[route.key] = { x: absoluteX, width };
    if (state.routes[state.index].key === route.key) {
      if (!ready) {
        indicatorX.value = absoluteX;
        indicatorWidth.value = width;
        setReady(true);
      } else {
        moveIndicatorTo(route.key);
      }
    }
  };

  const handleRightGroupLayout = (event) => {
    rightGroupOffsetRef.current = event.nativeEvent.layout.x;
  };

  const renderItem = ({ route, index }, isRightGroup) => {
    const { options } = descriptors[route.key];
    const label = options.tabBarLabel ?? options.title ?? route.name;
    const focused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return <TabItem key={route.key} name={route.name} label={label} focused={focused} onPress={onPress} onLayout={handleItemLayout(route, isRightGroup)} />;
  };

  const onCenterPress = () => {
    const focused = state.index === centerIndex;
    const event = navigation.emit({ type: 'tabPress', target: centerRoute.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(centerRoute.name);
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
    opacity: ready ? 1 : 0,
  }));

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || SPACING.two }]}>
      <View style={styles.bar}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />

        <View style={styles.sideGroup}>{leftRoutes.map((r) => renderItem(r, false))}</View>
        <View style={styles.centerGap} />
        <View style={styles.sideGroup} onLayout={handleRightGroupLayout}>
          {rightRoutes.map((r) => renderItem(r, true))}
        </View>

        <View style={styles.centerOverlay} pointerEvents="box-none">
          <CenterTabItem
            label={descriptors[centerRoute.key].options.tabBarLabel ?? descriptors[centerRoute.key].options.title ?? centerRoute.name}
            onPress={onCenterPress}
          />
        </View>
      </View>
    </View>
  );
};

export default CustomTabBar;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.three,
    paddingTop: SPACING.four,
  },
  bar: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#171717',
    borderRadius: RADIUS.sheet,
    paddingVertical: SPACING.two,
    paddingHorizontal: SPACING.one,
    ...SHADOWS.raised,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: SPACING.three,
    height: INDICATOR_HEIGHT,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.primary,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
  },
  centerGap: {
    width: 64,
  },
  centerOverlay: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: SPACING.two,
    paddingVertical: SPACING.one,
    borderRadius: RADIUS.chip,
  },
  itemFocused: {
    flexDirection: 'row',
    // gap: 2,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
  },
  label: {
    ...TYPOGRAPHY.smallBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  centerItem: {
    alignItems: 'center',
    gap: 2,
  },
  centerCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    ...SHADOWS.button,
  },
});
