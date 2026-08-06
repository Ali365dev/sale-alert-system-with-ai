import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useFavorites } from '@/state/favorites';
import { Brand, Deal } from '@/types/dealpulse';

import { BrandLogo } from './brand-logo';
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
  const [copied, setCopied] = useState(false);
  const favorite = isFavorite(deal.id);

  const onCopy = async () => {
    if (!deal.promoCode) return;
    await Clipboard.setStringAsync(deal.promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Animated.View style={[animatedStyle, styles.card, style]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.header}>
          <BrandLogo initials={brand?.initials ?? '?'} size={40} tone="filled" />
          <View style={styles.headerText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {brand?.name ?? 'Unknown brand'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {deal.category}
            </ThemedText>
          </View>
          <Pressable hitSlop={8} onPress={() => toggleFavorite(deal.id)}>
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={favorite ? '#B7131A' : '#171717'}
            />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <SaleBadge label={deal.discountLabel} tone={deal.isPercentageOff ? 'yellow' : 'red'} />
          {deal.isFeatured ? (
            <SaleBadge label="Verified" tone="gray" icon="checkmark-circle" />
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

        {deal.promoCode && (
          <Pressable onPress={onCopy} style={styles.couponRow}>
            <ThemedText type="smallBold">{deal.promoCode}</ThemedText>
            <ThemedText type="smallBold" style={styles.copyLabel}>
              {copied ? 'Copied' : 'Copy Code'}
            </ThemedText>
          </Pressable>
        )}

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
    flexDirection: 'row',
    gap: Spacing.two,
  },
  title: {
    marginTop: Spacing.one,
  },
  description: {
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.one,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  copyLabel: {
    color: '#B7131A',
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
