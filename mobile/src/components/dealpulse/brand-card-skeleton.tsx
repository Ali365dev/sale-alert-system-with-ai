import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Skeleton } from './skeleton';

/** Placeholder matching BrandCard's footprint. */
export function BrandCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={64} height={64} radius={32} />
      <Skeleton width={56} height={12} style={styles.gapTop} />
      <Skeleton width={40} height={10} style={styles.gapSmall} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    width: 84,
  },
  gapTop: {
    marginTop: Spacing.two,
  },
  gapSmall: {
    marginTop: 4,
  },
});
