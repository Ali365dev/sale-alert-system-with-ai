import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

export function SaleBadge({ label = 'SALE' }: { label?: string }) {
  return (
    <View style={styles.badge}>
      <ThemedText type="label" style={styles.text}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#E7000B',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.chip,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});
