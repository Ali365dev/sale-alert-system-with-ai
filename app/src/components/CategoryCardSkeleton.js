import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SHADOWS, SPACING } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import Skeleton from './Skeleton';

/** Placeholder matching CategoryCard's default centered footprint. */
const CategoryCardSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Skeleton width={64} height={64} radius={32} />
      <Skeleton width="65%" height={14} style={styles.gapTop} />
      <Skeleton width={72} height={22} radius={999} style={styles.gapSmall} />
    </View>
  );
};

export default CategoryCardSkeleton;

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      minHeight: 168,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 20,
      paddingVertical: 22,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.card,
    },
    gapTop: {
      marginTop: 10,
    },
    gapSmall: {
      marginTop: 10,
    },
  });
