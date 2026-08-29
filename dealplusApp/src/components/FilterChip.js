import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';

const FilterChip = ({ label, selected, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
};

export default FilterChip;

const createStyles = (colors) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
      borderRadius: RADIUS.chip,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      borderColor: colors.primary,
    },
    label: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    labelSelected: {
      color: colors.primary,
    },
  });
