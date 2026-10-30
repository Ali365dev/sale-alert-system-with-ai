import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';

const FilterChip = ({ label, selected, onPress, tone = 'outline' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const soft = tone === 'soft';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, soft && styles.chipSoft, selected && styles.chipSelected]}>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

export default FilterChip;

const createStyles = (colors) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two + 2,
      minHeight: 36,
      borderRadius: RADIUS.chip,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    chipSoft: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 0,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    label: {
      ...TYPOGRAPHY.smallBold,
      color: colors.textSecondary,
    },
    labelSelected: {
      color: colors.onPrimary,
    },
  });
