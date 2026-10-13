import { Platform, Vibration } from 'react-native';
import { shouldLoadNativePackage } from './turboModules';

/**
 * Tiny tap for copy only. Uses selection haptic when the native module is
 * linked; otherwise a short Android pulse (skips iOS Vibration — that buzz is too strong).
 */
export function hapticCopy() {
  if (shouldLoadNativePackage('RNHapticFeedback')) {
    try {
      const HapticFeedback = require('react-native-haptic-feedback').default;
      HapticFeedback.trigger('selection', {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: false,
      });
      return;
    } catch {
      // fall through
    }
  }

  if (Platform.OS === 'android') {
    Vibration.vibrate(10);
  }
}
