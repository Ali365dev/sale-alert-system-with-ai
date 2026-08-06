import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { CouponCodeBlock } from '@/components/dealpulse/coupon-code-block';
import { DealCardCompact } from '@/components/dealpulse/deal-card-compact';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SectionHeader } from '@/components/dealpulse/section-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';

function expiryLabel(expiresAt: string): string {
  if (!expiresAt) return 'No expiry';
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends in 1 day';
  return `Ends in ${days} days`;
}

export default function DealDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deals, brandsById } = useAppData();

  const deal = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  const brand = deal ? brandsById[deal.brandId] : undefined;
  const relatedDeals = useMemo(
    () => (deal ? deals.filter((d) => d.brandId === deal.brandId && d.id !== deal.id).slice(0, 6) : []),
    [deals, deal]
  );

  if (!deal) {
    return (
      <ThemedView style={styles.container}>
        <TopAppBar showBack title="Deal Details" hideSearch hideProfile />
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

  const linkUrl = deal.website ?? brand?.website ?? null;

  return (
    <ThemedView style={styles.container}>
      <TopAppBar
        showBack
        title="Deal Details"
        hideSearch
        hideProfile
        rightIcon="share-outline"
        onPressRight={() => Share.share({ message: `${deal.title} — ${deal.discountLabel}` })}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: deal.image }} style={styles.heroImage} contentFit="cover" />
          <View style={styles.heroBadge}>
            <ThemedText type="label" style={styles.heroBadgeLabel}>
              Up to {deal.discountLabel.replace('-', '')} OFF
            </ThemedText>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.brandRow}>
            <BrandLogo initials={brand?.initials ?? '?'} size={44} />
            <View style={styles.brandText}>
              <View style={styles.brandNameRow}>
                <ThemedText type="subtitle">{brand?.name ?? 'Unknown brand'}</ThemedText>
                {deal.isFeatured && <Ionicons name="checkmark-circle" size={16} color="#B7131A" />}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {expiryLabel(deal.expiresAt) === 'Expired' ? 'Expired Deal' : 'Active Deal'}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="headline" style={styles.title}>
            {deal.title}
          </ThemedText>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <ThemedText type="small" themeColor="textSecondary">
              {expiryLabel(deal.expiresAt)}
            </ThemedText>
          </View>

          {deal.promoCode && (
            <View style={styles.section}>
              <CouponCodeBlock code={deal.promoCode} />
            </View>
          )}

          {deal.highlights.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="headline" style={styles.sectionHeading}>
                Deal Highlights
              </ThemedText>
              <View style={styles.divider} />
              <View style={styles.bulletList}>
                {deal.highlights.map((h, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <ThemedText type="default">{'•'}</ThemedText>
                    <ThemedText type="default" themeColor="textSecondary" style={styles.bulletText}>
                      {h}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textSecondary">
              TERMS & CONDITIONS
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.terms}>
              {deal.terms}
            </ThemedText>
          </View>
        </View>

        {relatedDeals.length > 0 && (
          <View style={styles.relatedSection}>
            <SectionHeader title="Similar Offers" onViewAll={() => router.push('/search')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}>
              {relatedDeals.map((related) => (
                <DealCardCompact
                  key={related.id}
                  deal={related}
                  brand={brand}
                  onPress={() => router.push(`/deal/${related.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton
          label="Visit Store"
          icon="open-outline"
          disabled={!linkUrl}
          onPress={() => linkUrl && Linking.openURL(linkUrl)}
        />
      </View>
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
  heroBadge: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    backgroundColor: '#F5CB1B',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  heroBadgeLabel: {
    color: '#171717',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brandText: {
    gap: 2,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    marginTop: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.one,
  },
  section: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  sectionHeading: {
    marginBottom: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0DADA',
    marginBottom: Spacing.two,
  },
  bulletList: {
    gap: Spacing.two,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
  },
  terms: {
    lineHeight: 20,
  },
  relatedSection: {
    marginTop: Spacing.five,
    gap: Spacing.three,
  },
  relatedList: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
    backgroundColor: '#FFFFFF',
  },
});
