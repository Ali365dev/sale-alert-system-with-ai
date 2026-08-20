import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';

const SecondaryButton = ({ label, onPress, style, icon, variant = 'muted' }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const outline = variant === 'outline';

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, outline && styles.outline]}>
        {icon && <Icon name={icon} size={16} color={outline ? '#B7131A' : '#171717'} />}
        <Text style={outline ? styles.labelOutline : styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

export default SecondaryButton;

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: SPACING.two,
    backgroundColor: '#F8F9FB',
    paddingVertical: SPACING.three,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0DADA',
  },
  outline: {
    backgroundColor: '#FFFFFF',
    borderColor: '#B7131A',
    borderRadius: RADIUS.chip,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: '#171717',
    fontSize: 15,
  },
  labelOutline: {
    ...TYPOGRAPHY.label,
    color: '#B7131A',
    fontSize: 15,
  },
});
