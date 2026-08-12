import { StyleSheet, View } from 'react-native';

import { Radius, Shadow, Spacing } from '@/constants/theme';

import { Skeleton } from './skeleton';

/** Placeholder matching DealCard's footprint so the loading -> loaded swap doesn't jump. */
export function DealCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Skeleton width={45} height={45} radius={22.5} />
        <View style={styles.headerText}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="35%" height={11} style={styles.gapTop} />
        </View>
      </View>

      <View style={styles.badgeRow}>
        <Skeleton width={60} height={20} radius={8} />
        <Skeleton width={50} height={20} radius={8} />
      </View>

      <Skeleton width="90%" height={14} style={styles.gapTop} />
      <Skeleton width="70%" height={14} style={styles.gapSmall} />
      <Skeleton width="100%" height={12} style={styles.gapTop} />
      <Skeleton width="80%" height={12} style={styles.gapSmall} />

      <Skeleton width="45%" height={12} style={styles.gapTop} />

      <Skeleton width="100%" height={44} radius={Radius.button} style={styles.gapTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    ...Shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  gapTop: {
    marginTop: Spacing.two,
  },
  gapSmall: {
    marginTop: 6,
  },
});
