import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  checked: boolean;
  onPress: () => void;
}

export function ToggleRow({ icon, label, checked, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={18} color="#171717" />
      <ThemedText type="default" style={styles.label}>
        {label}
      </ThemedText>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#F0DADA',
  },
  label: {
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.chip,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#B7131A',
    borderColor: '#B7131A',
  },
});
