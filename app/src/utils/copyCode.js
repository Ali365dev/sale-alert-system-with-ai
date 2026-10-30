import Clipboard from '@react-native-clipboard/clipboard';
import { showSuccessToast } from './CustomToast';
import { hapticCopy } from './haptics';

/**
 * Copy a promo code. Haptic runs only here (not on View).
 * @param {string} code
 * @param {{ toast?: boolean }} [options] — set toast:false when the UI shows its own "Copied" state
 */
export function copyCode(code, { toast = true } = {}) {
  const value = String(code || '').trim();
  if (!value) return false;
  Clipboard.setString(value);
  hapticCopy();
  if (toast) {
    showSuccessToast('Apply at checkout & enjoy the deal!', 'Copied!');
  }
  return true;
}
