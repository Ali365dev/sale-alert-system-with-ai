import { useEffect, useRef, useState } from 'react';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import useDataStore from '../state/dataStore';
import useOnboardingGateStore from '../state/onboardingGateStore';
import { resetAndNavigate } from '../utils/NavigationUtil';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../styles/theme';

const backgroundImage = require('../assets/images/splash-background.png');

const BG = '#0A0A0A';
const RED = '#B7131A';
const RED_BRIGHT = '#E7000B';



/** Keeps the choreographed intro on screen even if data loads instantly. */
const MIN_VISIBLE_MS = 1800;
/** Hard ceiling so the splash can never block the app forever — e.g. a cold-starting
 * backend or a hung request with no axios timeout configured. */
const MAX_WAIT_MS = 6000;

function PulseRing({ delay }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [delay, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.22,
    transform: [{ scale: 1 + t.value * 0.8 }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.pulseRing, animatedStyle]} />;
}

/** Initial route of the stack — decides where the app boots into (onboarding vs. main tabs) once
 * the intro animation has played and initial deal data has loaded, then hands off via a stack
 * reset so the splash isn't left in the back-stack. */
const SplashScreen = () => {
  const insets = useSafeAreaInsets();
  const loading = useDataStore((state) => state.loading);
  const hasOnboarded = useOnboardingGateStore((state) => state.hasOnboarded);

  const [started, setStarted] = useState(false);
  const startTimeRef = useRef(0);
  const exitTriggeredRef = useRef(false);

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
    startTimeRef.current = Date.now();
    setStarted(true);

    bgScale.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 4200, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) })),
      -1,
      false,
    );

    iconOpacity.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    iconScale.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.2)) });

    textOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    textY.value = withDelay(500, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));

    taglineOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));

    progressSectionOpacity.value = withDelay(1000, withTiming(1, { duration: 300 }));
    progress.value = withDelay(1000, withSequence(withTiming(0.82, { duration: 2200, easing: Easing.out(Easing.quad) }), withTiming(0.95, { duration: 7000, easing: Easing.linear })));
    loadingLabelOpacity.value = withDelay(1000, withRepeat(withSequence(withTiming(0.85, { duration: 900 }), withTiming(0.35, { duration: 900 })), -1, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (holdMs) => {
    if (exitTriggeredRef.current) return;
    exitTriggeredRef.current = true;
    progress.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });

    setTimeout(() => {
      resetAndNavigate(hasOnboarded ? 'MainTabs' : 'OnboardingWelcomeScreen');
    }, holdMs);
  };

  useEffect(() => {
    if (!started || loading || exitTriggeredRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    const timer = setTimeout(() => finish(550), remaining);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, loading]);

  useEffect(() => {
    if (!started) return;
    // Fires regardless of loading state — guarantees the splash always hands off eventually.
    const ceiling = setTimeout(() => finish(0), MAX_WAIT_MS);
    return () => clearTimeout(ceiling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const backgroundStyle = useAnimatedStyle(() => ({ transform: [{ scale: bgScale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: iconOpacity.value, transform: [{ scale: iconScale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value, transform: [{ translateY: textY.value }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const progressSectionStyle = useAnimatedStyle(() => ({ opacity: progressSectionOpacity.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const loadingLabelStyle = useAnimatedStyle(() => ({ opacity: loadingLabelOpacity.value }));

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <Animated.View style={[StyleSheet.absoluteFill,backgroundStyle]} pointerEvents="none">
        <Image source={backgroundImage} style={{}} resizeMode="contain" height={SCREEN_HEIGHT} width={SCREEN_WIDTH} />
      </Animated.View>

      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <PulseRing delay={0} />
          <PulseRing delay={800} />
          <Animated.View style={[styles.icon, iconStyle]}>
            <Icon name="pulse" size={44} color="#FFFFFF" />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.wordmark, textStyle]}>
          Deal<Text style={styles.wordmarkAccent}>Pulse</Text>
        </Animated.Text>
        <Animated.Text style={[styles.tagline, taglineStyle]}>DEALS THAT MOVE YOU</Animated.Text>
      </View>

      <Animated.View style={[styles.progressSection, { paddingBottom: insets.bottom + 32 }, progressSectionStyle]}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Animated.Text style={[styles.loadingLabel, loadingLabelStyle]}>LOADING...</Animated.Text>
      </Animated.View>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 20,
  },
  wordmarkAccent: {
    color: RED_BRIGHT,
  },
  tagline: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
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
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 12,
  },
});
