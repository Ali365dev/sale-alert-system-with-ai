import { StyleSheet, View } from 'react-native';
import { RADIUS, SHADOWS, SPACING } from '../styles/theme';
import Skeleton from './Skeleton';

/** Placeholder matching CategoryCard's compact footprint. */
const CategoryCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <Skeleton width={44} height={44} radius={22} />
      <Skeleton width="70%" height={14} style={styles.gapTop} />
      <Skeleton width="45%" height={11} style={styles.gapSmall} />
    </View>
  );
};

export default CategoryCardSkeleton;

const styles = StyleSheet.create({
  card: {
    minHeight: 148,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.four,
    paddingHorizontal: SPACING.three,
    ...SHADOWS.card,
  },
  gapTop: {
    marginTop: SPACING.four,
  },
  gapSmall: {
    marginTop: 6,
  },
});
