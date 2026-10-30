import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS } from '../styles/theme';
import useTheme from '../hooks/useTheme';

/** Compact interest chip used on Deal Preference / onboarding. */
const TipCard = ({ label, icon, selected, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="button" accessibilityState={{ selected }}>
      <View style={[styles.iconBubble, selected && styles.iconBubbleSelected]}>
        <Icon name={icon} size={15} color={selected ? colors.primary : colors.textSecondary} />
      </View>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
};

export default TipCard;

const createStyles = (colors) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingVertical: 10,
      paddingLeft: 8,
      paddingRight: 14,
    },
    chipSelected: {
      backgroundColor: colors.primary,
    },
    iconBubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBubbleSelected: {
      backgroundColor: '#FFFFFF',
    },
    chipLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    chipLabelSelected: {
      color: '#FFFFFF',
    },
  });
