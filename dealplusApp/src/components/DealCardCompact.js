import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useFavoritesStore from '../state/favoritesStore';
import BrandLogo from './BrandLogo';
import FavoriteButton from './FavoriteButton';
import SaleBadge from './SaleBadge';
import { usePressScale } from '../hooks/usePressScale';

const DealCardCompact = ({ deal, brand, onPress }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const favorite = useFavoritesStore((state) => state.favoriteIds.includes(deal.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  return (
    <Animated.View style={[animatedStyle, styles.card]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.topRow}>
          <BrandLogo initials={brand?.initials ?? '?'} size={32} tone="filled" />
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

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
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
    color: '#6B7280',
  },
  title: {
    ...TYPOGRAPHY.smallBold,
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
    color: '#B7131A',
    fontSize: 12,
  },
});
