import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import { usePressScale } from '../hooks/usePressScale';

const SelectableCard = ({ label, icon, selected, onPress, iconVariant = 'plain', fullWidth }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View style={[animatedStyle, fullWidth ? styles.wrapperFull : styles.wrapper]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.card, selected && styles.cardSelected]}>
        {icon &&
          (iconVariant === 'circle' ? (
            <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
              <Icon name={icon} size={22} color={selected ? '#FFFFFF' : '#57302D'} />
            </View>
          ) : (
            <Icon name={icon} size={26} color={selected ? '#FFFFFF' : colors.primary} />
          ))}
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

export default SelectableCard;

const createStyles = (colors) =>
  StyleSheet.create({
    wrapper: {
      width: '48%',
      marginBottom: SPACING.three,
    },
    wrapperFull: {
      width: '100%',
      marginBottom: SPACING.three,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: SPACING.four,
      paddingHorizontal: SPACING.three,
      alignItems: 'center',
      gap: SPACING.two,
    },
    cardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    label: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    labelSelected: {
      color: '#FFFFFF',
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.backgroundElement,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircleSelected: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
  });
