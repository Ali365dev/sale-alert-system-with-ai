import { StyleSheet, View } from 'react-native';
import { SPACING } from '../styles/theme';
import Skeleton from './Skeleton';

/** Placeholder matching BrandCard's footprint. */
const BrandCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <Skeleton width={64} height={64} radius={32} />
      <Skeleton width={56} height={12} style={styles.gapTop} />
      <Skeleton width={40} height={10} style={styles.gapSmall} />
    </View>
  );
};

export default BrandCardSkeleton;

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    width: 84,
  },
  gapTop: {
    marginTop: SPACING.two,
  },
  gapSmall: {
    marginTop: 4,
  },
});
