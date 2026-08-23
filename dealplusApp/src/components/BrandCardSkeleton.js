import { StyleSheet, View } from 'react-native';
import { RADIUS, SHADOWS, SPACING } from '../styles/theme';
import Skeleton from './Skeleton';

/** Placeholder matching BrandCard's footprint. */
const BrandCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <Skeleton width={64} height={64} radius={32} />
      <Skeleton width={80} height={14} style={styles.gapTop} />
      <Skeleton width={56} height={11} style={styles.gapSmall} />
      <Skeleton width={70} height={12} style={styles.gapSmall} />
    </View>
  );
};

export default BrandCardSkeleton;

const styles = StyleSheet.create({
  card: {
    width: 152,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: SPACING.three,
    ...SHADOWS.card,
  },
  gapTop: {
    marginTop: SPACING.two,
  },
  gapSmall: {
    marginTop: 6,
  },
});
