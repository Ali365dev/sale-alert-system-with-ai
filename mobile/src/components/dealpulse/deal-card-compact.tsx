import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useFavorites } from '@/state/favorites';
import { Brand, Deal } from '@/types/dealpulse';

import { BrandLogo } from './brand-logo';
import { FavoriteButton } from './favorite-button';
import { SaleBadge } from './sale-badge';
import { usePressScale } from './use-press-scale';

interface Props {
  deal: Deal;
  brand?: Brand;
  onPress?: () => void;
}

export function DealCardCompact({ deal, brand, onPress }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(deal.id);

  return (
    <Animated.View style={[animatedStyle, styles.card]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.topRow}>
          <BrandLogo initials={brand?.initials ?? '?'} size={32} tone="filled" />
          <FavoriteButton active={favorite} onPress={() => toggleFavorite(deal.id)} size={18} />
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {brand?.name ?? 'Unknown brand'}
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
          {deal.title}
        </ThemedText>
        <View style={styles.bottomRow}>
          <SaleBadge label={deal.discountLabel} tone={deal.isPercentageOff ? 'yellow' : 'red'} />
          <Pressable onPress={onPress} hitSlop={4}>
            <ThemedText type="link" style={styles.viewDetails}>
              View Details
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    gap: 4,
    ...Shadow.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  viewDetails: {
    color: '#B7131A',
    fontSize: 12,
  },
});
