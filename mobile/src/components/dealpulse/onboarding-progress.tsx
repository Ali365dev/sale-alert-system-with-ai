import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={styles.track}>
          <View
            style={[
              styles.fill,
              i < step && styles.fillFull,
              i === step && styles.fillHalf,
              i > step && styles.fillNone,
            ]}
          />
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        {step + 1}/{total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#B7131A',
  },
  fillFull: {
    width: '100%',
  },
  fillHalf: {
    width: '50%',
  },
  fillNone: {
    width: 0,
  },
});
