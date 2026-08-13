import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppData } from '@/state/data';

const backgroundImage = require('../../assets/images/splash-background.png');

const BG = '#0A0A0A';
const RED = '#B7131A';
const RED_BRIGHT = '#E7000B';

/** Keeps the choreographed intro on screen even if data loads instantly. */
const MIN_VISIBLE_MS = 1800;

function PulseRing({ delay }: { delay: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false)
    );
  }, [delay, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.22,
    transform: [{ scale: 1 + t.value * 0.8 }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.pulseRing, animatedStyle]} />;
}

export function AnimatedSplashOverlay() {
  const insets = useSafeAreaInsets();
  const { loading } = useAppData();

  const [started, setStarted] = useState(false);
  const [visible, setVisible] = useState(true);
  const startTimeRef = useRef(0);
  const exitTriggeredRef = useRef(false);

  const overlayOpacity = useSharedValue(1);
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.85);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(10);
  const taglineOpacity = useSharedValue(0);
  const progressSectionOpacity = useSharedValue(0);
  const progress = useSharedValue(0);
  const loadingLabelOpacity = useSharedValue(0.35);
  const bgScale = useSharedValue(1);

  useEffect(() => {
    bgScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!started) return;

    iconOpacity.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    iconScale.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.2)) });

    textOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    textY.value = withDelay(500, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));

    taglineOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));

    progressSectionOpacity.value = withDelay(1000, withTiming(1, { duration: 300 }));
    progress.value = withDelay(
      1000,
      withSequence(
        withTiming(0.82, { duration: 2200, easing: Easing.out(Easing.quad) }),
        withTiming(0.95, { duration: 7000, easing: Easing.linear })
      )
    );
    loadingLabelOpacity.value = withDelay(
      1000,
      withRepeat(
        withSequence(withTiming(0.85, { duration: 900 }), withTiming(0.35, { duration: 900 })),
        -1,
        true
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    if (!started || loading || exitTriggeredRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    const timer = setTimeout(() => {
      exitTriggeredRef.current = true;
      progress.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });

      const holdTimer = setTimeout(() => {
        overlayOpacity.value = withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) });
        setTimeout(() => setVisible(false), 470);
      }, 550);

      return () => clearTimeout(holdTimer);
    }, remaining);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, loading]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const backgroundStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgScale.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const progressSectionStyle = useAnimatedStyle(() => ({ opacity: progressSectionOpacity.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const loadingLabelStyle = useAnimatedStyle(() => ({ opacity: loadingLabelOpacity.value }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={() => {
        if (started) return;
        SplashScreen.hideAsync().finally(() => {
          startTimeRef.current = Date.now();
          setStarted(true);
        });
      }}
      style={[styles.container, containerStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, backgroundStyle]} pointerEvents="none">
        <Image source={backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>

      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <PulseRing delay={0} />
          <PulseRing delay={800} />
          <Animated.View style={[styles.icon, iconStyle]}>
            <Ionicons name="flash" size={44} color="#FFFFFF" />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.wordmark, textStyle]}>DealPulse</Animated.Text>
        <Animated.Text style={[styles.tagline, taglineStyle]}>DEALS THAT MOVE YOU</Animated.Text>
      </View>

      <Animated.View
        style={[styles.progressSection, { paddingBottom: insets.bottom + 32 }, progressSectionStyle]}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Animated.Text style={[styles.loadingLabel, loadingLabelStyle]}>LOADING...</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: RED_BRIGHT,
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: RED_BRIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 40,
    fontFamily: 'Montserrat_800ExtraBold',
    letterSpacing: -0.5,
    marginTop: 20,
  },
  tagline: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    letterSpacing: 3,
    marginTop: 10,
  },
  progressSection: {
    position: 'absolute',
    bottom: 0,
    width: '55%',
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#262626',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: RED_BRIGHT,
  },
  loadingLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: 2,
    marginTop: 12,
  },
});
