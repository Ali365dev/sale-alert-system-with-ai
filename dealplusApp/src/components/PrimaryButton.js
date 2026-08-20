import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';

const PrimaryButton = ({ label, onPress, disabled, style, icon, iconPosition = 'right', pill }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const iconEl = icon && <Icon name={icon} size={18} color="#FFFFFF" />;

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={[styles.button, pill && styles.pill, disabled && styles.disabled]}>
        {iconPosition === 'left' && iconEl}
        <Text style={styles.label}>{label}</Text>
        {iconPosition === 'right' && iconEl}
      </Pressable>
    </Animated.View>
  );
};

export default PrimaryButton;

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: SPACING.two,
    backgroundColor: '#B7131A',
    paddingVertical: SPACING.three,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.button,
  },
  pill: {
    borderRadius: RADIUS.chip,
    paddingVertical: SPACING.three - 2,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
    fontSize: 15,
  },
});
