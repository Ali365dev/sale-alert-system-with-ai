import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/dealpulse/animated-list-item';
import { BrandCard } from '@/components/dealpulse/brand-card';
import { BrandCardSkeleton } from '@/components/dealpulse/brand-card-skeleton';
import { CategoryCard } from '@/components/dealpulse/category-card';
import { CategoryCardSkeleton } from '@/components/dealpulse/category-card-skeleton';
import { DealCard } from '@/components/dealpulse/deal-card';
import { DealCardSkeleton } from '@/components/dealpulse/deal-card-skeleton';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { ExpiringSoonCard } from '@/components/dealpulse/expiring-soon-card';
import { HeroCarousel } from '@/components/dealpulse/hero-carousel';
import { SectionHeader } from '@/components/dealpulse/section-header';
import { Skeleton } from '@/components/dealpulse/skeleton';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { Deal } from '@/types/dealpulse';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deals, categories, brandsById, brands, loading, error, refresh } = useAppData();

  const heroDeals = useMemo(() => {
    const withExpiry = deals.filter((d) => !!d.expiresAt);
    const sorted = [...withExpiry].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    return sorted.slice(0, 4);
  }, [deals]);
  const trendingBrands = useMemo(
    () => [...brands].sort((a, b) => b.dealCount - a.dealCount).slice(0, 8),
    [brands]
  );
  const previewCategories = useMemo(() => categories.slice(0, 4), [categories]);
  const expiringSoon = useMemo(() => {
    const withExpiry = deals.filter((d) => !!d.expiresAt);
    const sorted = [...withExpiry].sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
    );
    return sorted.slice(0, 4);
  }, [deals]);

  const openDeal = (deal: Deal) => router.push(`/deal/${deal.id}`);
  const openBrand = (brandId: string) => router.push(`/brand/${brandId}`);

  return (
    <ThemedView style={styles.container}>
      <TopAppBar />

      {loading && deals.length === 0 ? (
        <Animated.View exiting={FadeOut.duration(200)} style={styles.content}>
          <View style={styles.skeletonPad}>
            <Skeleton width="100%" height={48} radius={Radius.chip} />
          </View>

          <View style={styles.section}>
            <Skeleton width={140} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.rowList}>
              {[0, 1, 2, 3].map((i) => (
                <BrandCardSkeleton key={i} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Skeleton width={110} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.skeletonPad}>
              <Skeleton width="100%" height={210} radius={Radius.card} />
            </View>
          </View>

          <View style={styles.section}>
            <Skeleton width={160} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.categoryGrid}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.categoryItem}>
                  <CategoryCardSkeleton />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Skeleton width={130} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.dealsList}>
              {[0, 1].map((i) => (
                <DealCardSkeleton key={i} />
              ))}
            </View>
          </View>
        </Animated.View>
      ) : error && deals.length === 0 ? (
        <EmptyState
          variant="error"
          icon="warning-outline"
          title="Couldn't load deals"
          body="Check your connection and try again."
          ctaLabel="Try again"
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
          <Pressable style={styles.searchBar} onPress={() => router.push('/search')}>
            <Ionicons name="search" size={18} color="#6B7280" />
            <ThemedText type="default" themeColor="textSecondary">
              Search brands or deals...
            </ThemedText>
          </Pressable>

          {trendingBrands.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Trending Brands" onViewAll={() => router.push('/brand')} />
              <FlatList
                horizontal
                data={trendingBrands}
                keyExtractor={(b) => b.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowList}
                renderItem={({ item, index }) => (
                  <AnimatedListItem index={index}>
                    <BrandCard brand={item} onPress={() => openBrand(item.id)} />
                  </AnimatedListItem>
                )}
              />
            </View>
          )}

          {heroDeals.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Hot Deals" onViewAll={() => router.push('/search')} />
              <HeroCarousel deals={heroDeals} brandsById={brandsById} onPressDeal={openDeal} />
            </View>
          )}

          {previewCategories.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Browse Categories" onViewAll={() => router.push('/categories')} />
              <View style={styles.categoryGrid}>
                {previewCategories.map((c, index) => (
                  <AnimatedListItem key={c.name} index={index} style={styles.categoryItem}>
                    <CategoryCard
                      category={c}
                      variant="compact"
                      onPress={() => router.push(`/search?category=${c.name}`)}
                      style={styles.categoryItemFill}
                    />
                  </AnimatedListItem>
                ))}
              </View>
            </View>
          )}

          {expiringSoon.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Expiring Soon" />
              <View style={styles.dealsList}>
                {expiringSoon.map((deal, index) => (
                  <AnimatedListItem key={deal.id} index={index}>
                    <ExpiringSoonCard deal={deal} onPress={() => openDeal(deal)} />
                  </AnimatedListItem>
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
              {deals.map((deal, index) => (
                <AnimatedListItem key={deal.id} index={index}>
                  <DealCard deal={deal} brand={brandsById[deal.brandId]} onPress={() => openDeal(deal)} />
                </AnimatedListItem>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    marginHorizontal: Spacing.four,
    height: 48,
  },
  skeletonPad: {
    paddingHorizontal: Spacing.four,
  },
  sectionTitleSkeleton: {
    marginHorizontal: Spacing.four,
  },
  rowList: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  categoryItem: {
    flexBasis: '47%',
  },
  categoryItemFill: {
    flexBasis: '100%',
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
