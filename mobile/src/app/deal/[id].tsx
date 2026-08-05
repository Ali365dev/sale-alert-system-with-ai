import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CouponCodeBlock } from '@/components/dealpulse/coupon-code-block';
import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SaleBadge } from '@/components/dealpulse/sale-badge';
import { SectionHeader } from '@/components/dealpulse/section-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useFavorites } from '@/state/favorites';

export default function DealDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deals, brandsById } = useAppData();
  const { isFavorite, toggleFavorite } = useFavorites();

  const deal = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  const brand = deal ? brandsById[deal.brandId] : undefined;
  const relatedDeals = useMemo(
    () => (deal ? deals.filter((d) => d.brandId === deal.brandId && d.id !== deal.id).slice(0, 6) : []),
    [deals, deal]
  );

  if (!deal) {
    return (
      <ThemedView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Deal not found"
          body="This offer may have expired or been removed."
          ctaLabel="Go Back"
          onPressCta={() => router.back()}
        />
      </ThemedView>
    );
  }

  const favorite = isFavorite(deal.id);
  const linkUrl = deal.website ?? brand?.website ?? null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: deal.image }} style={styles.heroImage} contentFit="cover" />
          <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
            <Pressable onPress={() => router.back()} style={styles.circleButton}>
              <Ionicons name="chevron-back" size={22} color="#171717" />
            </Pressable>
            <View style={styles.topBarRight}>
              <Pressable
                onPress={() => Share.share({ message: `${deal.title} — ${deal.discountLabel}` })}
                style={styles.circleButton}>
                <Ionicons name="share-outline" size={20} color="#171717" />
              </Pressable>
              <Pressable onPress={() => toggleFavorite(deal.id)} style={styles.circleButton}>
                <Ionicons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={favorite ? '#E7000B' : '#171717'}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <SaleBadge label={deal.isFlashSale ? 'HOT DEAL' : 'SALE'} />

          <ThemedText type="small" themeColor="textSecondary">
            {brand?.name ?? 'Unknown brand'}
          </ThemedText>
          <ThemedText type="title">{deal.discountLabel}</ThemedText>
          <ThemedText type="headline">{deal.title}</ThemedText>

          <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
            {deal.description}
          </ThemedText>

          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {deal.expiresAt ? `Expires ${new Date(deal.expiresAt).toLocaleDateString()}` : 'No expiry'}
            </ThemedText>
          </View>

          {deal.promoCode && (
            <View style={styles.section}>
              <CouponCodeBlock code={deal.promoCode} />
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold">Terms</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.terms}>
              {deal.terms}
            </ThemedText>
          </View>

          <PrimaryButton
            label="View Deal"
            style={styles.cta}
            disabled={!linkUrl}
            onPress={() => linkUrl && Linking.openURL(linkUrl)}
          />
        </View>

        {relatedDeals.length > 0 && (
          <View style={styles.relatedSection}>
            <SectionHeader title="Related Deals" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}>
              {relatedDeals.map((related) => (
                <DealCard
                  key={related.id}
                  deal={related}
                  brand={brand}
                  variant="grid"
                  onPress={() => router.push(`/deal/${related.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  description: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  metaRow: {
    marginTop: Spacing.two,
  },
  section: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  terms: {
    lineHeight: 20,
  },
  cta: {
    marginTop: Spacing.five,
  },
  relatedSection: {
    marginTop: Spacing.five,
    gap: Spacing.three,
  },
  relatedList: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
