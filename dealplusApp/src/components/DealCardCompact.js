import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import useFavoritesStore from '../state/favoritesStore';
import BrandLogo from './BrandLogo';
import FavoriteButton from './FavoriteButton';
import SaleBadge from './SaleBadge';
import { usePressScale } from '../hooks/usePressScale';

const DealCardCompact = ({ deal, brand, onPress }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const favorite = useFavoritesStore((state) => state.favoriteIds.includes(deal.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  return (
    <Animated.View style={[animatedStyle, styles.card]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.topRow}>
          <BrandLogo initials={brand?.initials ?? '?'} logoUrl={brand?.logoUrl} size={32} tone="filled" />
          <FavoriteButton active={favorite} onPress={() => toggleFavorite(deal.id)} size={18} />
        </View>
        <Text style={styles.brandName} numberOfLines={1}>
          {brand?.name ?? 'Unknown brand'}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {deal.title}
        </Text>
        <View style={styles.bottomRow}>
          <SaleBadge label={deal.discountLabel} tone={deal.isPercentageOff ? 'yellow' : 'red'} />
          <Pressable onPress={onPress} hitSlop={4}>
            <Text style={styles.viewDetails}>View Details</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default DealCardCompact;

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      width: 200,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.three,
      gap: 4,
      ...SHADOWS.card,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    brandName: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    title: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      fontSize: 14,
      lineHeight: 18,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.two,
    },
    viewDetails: {
      ...TYPOGRAPHY.link,
      color: colors.primary,
      fontSize: 12,
    },
  });
