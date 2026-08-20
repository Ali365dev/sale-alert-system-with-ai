import { Pressable, StyleSheet, Text } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';

const FilterChip = ({ label, selected, onPress }) => {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
};

export default FilterChip;

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
    borderRadius: RADIUS.chip,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
  },
  chipSelected: {
    borderColor: '#B7131A',
  },
  label: {
    ...TYPOGRAPHY.smallBold,
    color: '#171717',
  },
  labelSelected: {
    color: '#B7131A',
  },
});
