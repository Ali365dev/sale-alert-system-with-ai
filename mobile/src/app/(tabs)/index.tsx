import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandCard } from '@/components/dealpulse/brand-card';
import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { HeroCarousel } from '@/components/dealpulse/hero-carousel';
import { SectionHeader } from '@/components/dealpulse/section-header';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { Deal } from '@/types/dealpulse';

function isExpiringSoon(expiresAt: string): boolean {
  if (!expiresAt) return false;
  const days = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days <= 7 && days >= 0;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deals, brandsById, brands, loading, error, refresh } = useAppData();

  const featuredDeals = useMemo(() => deals.filter((d) => d.isFeatured), [deals]);
  const flashSales = useMemo(() => deals.filter((d) => d.isFlashSale), [deals]);
  const expiringSoon = useMemo(() => deals.filter((d) => isExpiringSoon(d.expiresAt)), [deals]);
  const trendingBrands = useMemo(
    () => [...brands].sort((a, b) => b.dealCount - a.dealCount).slice(0, 8),
    [brands]
  );

  const openDeal = (deal: Deal) => router.push(`/deal/${deal.id}`);
  const openBrand = (brandId: string) => router.push(`/brand/${brandId}`);

  const heroDeals = featuredDeals.length > 0 ? featuredDeals : deals.slice(0, 5);

  return (
    <ThemedView style={styles.container}>
      <TopAppBar />

      {loading && deals.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#171717" />
        </View>
      ) : error && deals.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't reach your backend"
          body={error}
          ctaLabel="Retry"
          onPressCta={refresh}
        />
      ) : deals.length === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title="No offers tracked yet"
          body="Once your backend pipeline picks up brand emails, deals will show up here automatically."
          ctaLabel="Refresh"
          onPressCta={refresh}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + BottomTabInset },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#171717" />}>
          {heroDeals.length > 0 && (
            <HeroCarousel deals={heroDeals} brandsById={brandsById} onPressDeal={openDeal} />
          )}

          {trendingBrands.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Trending Brands" onViewAll={() => router.push('/brand')} />
              <FlatList
                horizontal
                data={trendingBrands}
                keyExtractor={(b) => b.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowList}
                renderItem={({ item }) => (
                  <BrandCard brand={item} onPress={() => openBrand(item.id)} />
                )}
              />
            </View>
          )}

          {flashSales.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Flash Sales" />
              <FlatList
                horizontal
                data={flashSales}
                keyExtractor={(d) => d.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowList}
                renderItem={({ item }) => (
                  <DealCard
                    deal={item}
                    brand={brandsById[item.brandId]}
                    variant="grid"
                    onPress={() => openDeal(item)}
                  />
                )}
              />
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader title="Latest Offers" />
            <FlatList
              horizontal
              data={deals}
              keyExtractor={(d) => d.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rowList}
              renderItem={({ item }) => (
                <DealCard
                  deal={item}
                  brand={brandsById[item.brandId]}
                  variant="grid"
                  onPress={() => openDeal(item)}
                />
              )}
            />
          </View>

          {expiringSoon.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Expiring Soon" />
              <FlatList
                horizontal
                data={expiringSoon}
                keyExtractor={(d) => d.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowList}
                renderItem={({ item }) => (
                  <DealCard
                    deal={item}
                    brand={brandsById[item.brandId]}
                    variant="grid"
                    onPress={() => openDeal(item)}
                  />
                )}
              />
            </View>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.five,
    paddingTop: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  rowList: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
