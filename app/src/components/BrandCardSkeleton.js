import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RADIUS, SHADOWS, SPACING } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import Skeleton from './Skeleton';

/** Placeholder matching BrandCard's footprint. */
const BrandCardSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      width: 152,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
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
