import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { withSequence, withSpring } from 'react-native-reanimated';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';

const CouponCodeBlock = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const { animatedStyle, onPressIn, onPressOut, scale } = usePressScale();

  const onCopy = () => {
    Clipboard.setString(code);
    setCopied(true);
    scale.value = withSequence(withSpring(1.12, { damping: 8, stiffness: 400 }), withSpring(1));
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.codeSide}>
        <Text style={styles.promoLabel}>PROMO CODE</Text>
        <Text style={styles.code}>{code}</Text>
      </View>
      <Animated.View style={animatedStyle}>
        <Pressable onPress={onCopy} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.copyButton}>
          <Icon name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#FFFFFF" />
          <Text style={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

export default CouponCodeBlock;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    padding: SPACING.three,
  },
  codeSide: {
    gap: 2,
  },
  promoLabel: {
    ...TYPOGRAPHY.label,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  code: {
    ...TYPOGRAPHY.headline,
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#B7131A',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
    ...SHADOWS.button,
  },
  copyLabel: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
  },
});
