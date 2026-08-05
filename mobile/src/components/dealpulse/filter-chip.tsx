import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <ThemedText type="smallBold" style={selected ? styles.labelSelected : styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.chip,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  label: {
    color: '#171717',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
