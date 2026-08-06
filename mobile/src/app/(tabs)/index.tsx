import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandCard } from '@/components/dealpulse/brand-card';
import { CategoryCard } from '@/components/dealpulse/category-card';
import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { HeroCarousel } from '@/components/dealpulse/hero-carousel';
import { SectionHeader } from '@/components/dealpulse/section-header';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { Deal } from '@/types/dealpulse';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deals, categories, brandsById, brands, loading, error, refresh } = useAppData();

  const featuredDeals = useMemo(() => deals.filter((d) => d.isFeatured), [deals]);
  const trendingBrands = useMemo(
    () => [...brands].sort((a, b) => b.dealCount - a.dealCount).slice(0, 8),
    [brands]
  );
  const previewCategories = useMemo(() => categories.slice(0, 4), [categories]);

  const openDeal = (deal: Deal) => router.push(`/deal/${deal.id}`);
  const openBrand = (brandId: string) => router.push(`/brand/${brandId}`);

  const heroDeals = featuredDeals.length > 0 ? featuredDeals : deals.slice(0, 5);

  return (
    <ThemedView style={styles.container}>
      <TopAppBar />

      {loading && deals.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#B7131A" />
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
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#B7131A" />}>
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

          {previewCategories.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="headline" style={styles.sectionTitlePlain}>
                Browse Categories
              </ThemedText>
              <View style={styles.categoryGrid}>
                {previewCategories.map((c) => (
                  <CategoryCard
                    key={c.name}
                    category={c}
                    variant="compact"
                    onPress={() => router.push(`/search?category=${c.name}`)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.latestHeader}>
              <ThemedText type="headline">Latest Offers</ThemedText>
              <Pressable style={styles.filterLink} onPress={() => router.push('/search')}>
                <Ionicons name="filter-outline" size={16} color="#6B7280" />
                <ThemedText type="small" themeColor="textSecondary">
                  Filter
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.dealsList}>
              {deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  brand={brandsById[deal.brandId]}
                  onPress={() => openDeal(deal)}
                />
              ))}
            </View>
          </View>
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
  sectionTitlePlain: {
    paddingHorizontal: Spacing.four,
    marginBottom: -Spacing.one,
  },
  rowList: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  latestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  filterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dealsList: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
