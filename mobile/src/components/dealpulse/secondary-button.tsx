import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

import { usePressScale } from './use-press-scale';

interface Props {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'muted' | 'outline';
}

export function SecondaryButton({ label, onPress, style, icon, variant = 'muted' }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const outline = variant === 'outline';

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, outline && styles.outline]}>
        {icon && <Ionicons name={icon} size={16} color={outline ? '#B7131A' : '#171717'} />}
        <ThemedText type="label" style={outline ? styles.labelOutline : styles.label}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: '#F8F9FB',
    paddingVertical: Spacing.three,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0DADA',
  },
  outline: {
    backgroundColor: '#FFFFFF',
    borderColor: '#B7131A',
    borderRadius: Radius.chip,
  },
  label: {
    color: '#171717',
    fontSize: 15,
  },
  labelOutline: {
    color: '#B7131A',
    fontSize: 15,
  },
});
