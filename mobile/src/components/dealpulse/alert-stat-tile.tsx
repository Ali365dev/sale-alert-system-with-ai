import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tone?: 'primary' | 'accent' | 'neutral';
}

const TONE_COLOR = {
  primary: '#B7131A',
  accent: '#F5CB1B',
  neutral: '#171717',
} as const;

export function AlertStatTile({ icon, value, label, tone = 'neutral' }: Props) {
  const color = TONE_COLOR[tone];

  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={20} color={color} />
      <ThemedText type="headline" style={[styles.value, tone !== 'neutral' && { color }]}>
        {value}
      </ThemedText>
      <ThemedText type="label" themeColor="textSecondary" style={styles.label}>
        {label.toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    marginBottom: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    gap: 4,
    ...Shadow.card,
  },
  value: {
    marginTop: Spacing.one,
  },
  label: {
    letterSpacing: 0.5,
  },
});
