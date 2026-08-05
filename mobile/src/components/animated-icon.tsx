import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 500;

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    30: {
      opacity: 1,
    },
    100: {
      opacity: 0,
      easing: Easing.out(Easing.cubic),
    },
  });

  const logo = (
    <View style={styles.logoRow}>
      <Text style={styles.wordmark}>DealPulse</Text>
      <View style={styles.pulseDot} />
    </View>
  );

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {logo}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {logo}
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'Montserrat_800ExtraBold',
    letterSpacing: -0.5,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7000B',
    marginLeft: 4,
    marginTop: 6,
  },
});
