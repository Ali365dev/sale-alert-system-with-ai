import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';
import useTheme from '../hooks/useTheme';

const SecondaryButton = ({ label, onPress, style, icon, variant = 'muted' }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const outline = variant === 'outline';

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, outline && styles.outline]}>
        {icon && <Icon name={icon} size={16} color={outline ? colors.primary : colors.text} />}
        <Text style={outline ? styles.labelOutline : styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

export default SecondaryButton;

const createStyles = (colors) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      gap: SPACING.two,
      backgroundColor: colors.backgroundElement,
      paddingVertical: SPACING.three,
      borderRadius: RADIUS.button,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    outline: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: RADIUS.chip,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: colors.text,
      fontSize: 15,
    },
    labelOutline: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
      fontSize: 15,
    },
  });
