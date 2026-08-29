import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RADIUS, SHADOWS, SPACING } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import Skeleton from './Skeleton';

/** Placeholder matching CategoryCard's compact footprint. */
const CategoryCardSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Skeleton width={44} height={44} radius={22} />
      <Skeleton width="70%" height={14} style={styles.gapTop} />
      <Skeleton width="45%" height={11} style={styles.gapSmall} />
    </View>
  );
};

export default CategoryCardSkeleton;

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      minHeight: 148,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
