import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
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
  style?: ViewStyle;
}

function expiryLabel(expiresAt: string): string {
  if (!expiresAt) return 'No expiry';
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends in 1 day';
  return `Ends in ${days} days`;
}

function isNew(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 3;
}

export function DealCard({ deal, brand, onPress, style }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(deal.id);

  return (
    <Animated.View style={[animatedStyle, styles.card, style]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.header}>
          <BrandLogo initials={brand?.initials ?? '?'} size={45} tone="filled" />
          <View style={styles.headerText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {brand?.name ?? 'Unknown brand'}
            </ThemedText>
            <ThemedText type="code" themeColor="textSecondary" numberOfLines={1}>
              {deal.category}
            </ThemedText>
          </View>
          <FavoriteButton active={favorite} onPress={() => toggleFavorite(deal.id)} />
        </View>

        <View style={styles.badgeRow}>
          <SaleBadge label={deal.discountLabel} tone={deal.isPercentageOff ? 'yellow' : 'red'} />
          {deal.isFeatured ? (
            <SaleBadge label="Verified" tone="green" icon="checkmark-circle" />
          ) : (
            isNew(deal.createdAt) && <SaleBadge label="New" tone="gray" />
          )}
        </View>

        <ThemedText type="smallBold" style={styles.title} numberOfLines={2}>
          {deal.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.description}>
          {deal.description}
        </ThemedText>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <ThemedText type="small" themeColor="textSecondary">
            {expiryLabel(deal.expiresAt)}
          </ThemedText>
        </View>

        <View style={styles.ctaButton}>
          <ThemedText type="label" style={styles.ctaLabel}>
            View Deal
          </ThemedText>
          <Ionicons name="open-outline" size={15} color="#FFFFFF" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    gap: Spacing.two,
    ...Shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
  },
  badgeRow: {
    marginVertical: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  title: {
    marginVertical: Spacing.one,
  },
  description: {
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: Spacing.one,
  },
  ctaButton: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: '#171717',
    borderRadius: Radius.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  ctaLabel: {
    color: '#FFFFFF',
  },
});
