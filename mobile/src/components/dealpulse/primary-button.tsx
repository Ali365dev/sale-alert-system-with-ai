import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';

import { usePressScale } from './use-press-scale';

interface Props {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: keyof typeof Ionicons.glyphMap;
  pill?: boolean;
}

export function PrimaryButton({ label, onPress, disabled, style, icon, pill }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={[styles.button, pill && styles.pill, disabled && styles.disabled]}>
        <ThemedText type="label" style={styles.label}>
          {label}
        </ThemedText>
        {icon && <Ionicons name={icon} size={18} color="#FFFFFF" />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: '#B7131A',
    paddingVertical: Spacing.three,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.button,
  },
  pill: {
    borderRadius: Radius.chip,
    paddingVertical: Spacing.four - 2,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
  },
});
