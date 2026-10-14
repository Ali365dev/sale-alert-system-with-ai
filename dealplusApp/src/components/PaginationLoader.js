import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RADIUS, SPACING } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import Skeleton from './Skeleton';

/**
 * Footer skeleton shown while the next page of an already-loaded list is revealed.
 * `variant`: "list" (default deal/coupon rows), "grid" (2 tiles), "card" (sale-alert style).
 */
const PaginationLoader = ({ variant = 'list' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (variant === 'grid') {
    return (
      <View style={styles.gridWrap} accessibilityLabel="Loading more">
        {[0, 1].map((i) => (
          <View key={i} style={styles.gridTile}>
            <Skeleton width="100%" height={96} radius={18} />
            <Skeleton width="70%" height={12} radius={6} style={styles.gap} />
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'card') {
    return (
      <View style={styles.cardWrap} accessibilityLabel="Loading more">
        {[0, 1].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton width={76} height={76} radius={14} />
            <View style={styles.cardBody}>
              <Skeleton width="80%" height={16} radius={6} />
              <Skeleton width="45%" height={12} radius={6} />
              <Skeleton width="35%" height={14} radius={6} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.listWrap} accessibilityLabel="Loading more">
      {[0, 1].map((i) => (
        <View key={i} style={styles.listRow}>
          <Skeleton width={56} height={56} radius={14} />
          <View style={styles.listBody}>
            <Skeleton width="75%" height={14} radius={6} />
            <Skeleton width="50%" height={12} radius={6} />
            <Skeleton width="40%" height={12} radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
};

export default PaginationLoader;

const createStyles = (colors) =>
  StyleSheet.create({
    listWrap: {
      paddingVertical: SPACING.three,
      gap: SPACING.three,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      paddingHorizontal: SPACING.one,
    },
    listBody: { flex: 1, gap: SPACING.two },
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingVertical: SPACING.three,
      gap: SPACING.three,
    },
    gridTile: {
      width: '47%',
      gap: SPACING.two,
    },
    gap: { marginTop: 4 },
    cardWrap: {
      paddingVertical: SPACING.two,
      gap: SPACING.three,
    },
    card: {
      flexDirection: 'row',
      gap: SPACING.three,
      padding: SPACING.three,
      borderRadius: RADIUS.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardBody: { flex: 1, gap: SPACING.two, paddingTop: 2 },
  });
