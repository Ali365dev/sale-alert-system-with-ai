import { StyleSheet, View } from 'react-native';

import { Radius, Shadow, Spacing } from '@/constants/theme';

import { Skeleton } from './skeleton';

/** Placeholder matching CategoryCard's compact footprint. */
export function CategoryCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={44} height={44} radius={22} />
      <Skeleton width="70%" height={14} style={styles.gapTop} />
      <Skeleton width="45%" height={11} style={styles.gapSmall} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 148,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: Radius.card,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    ...Shadow.card,
  },
  gapTop: {
    marginTop: Spacing.four,
  },
  gapSmall: {
    marginTop: 6,
  },
});
