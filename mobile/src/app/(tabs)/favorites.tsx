import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandCard } from '@/components/dealpulse/brand-card';
import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useFavorites } from '@/state/favorites';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoriteIds } = useFavorites();
  const { deals, brands, brandsById } = useAppData();

  const favoriteDeals = useMemo(
    () => deals.filter((d) => favoriteIds.includes(d.id)),
    [deals, favoriteIds]
  );

  const followedBrands = useMemo(() => {
    const ids = new Set(favoriteDeals.map((d) => d.brandId));
    return brands.filter((b) => ids.has(b.id));
  }, [favoriteDeals, brands]);

  return (
    <ThemedView style={styles.container}>
      <TopAppBar />
      {favoriteDeals.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="No favorites yet"
          body="Tap the heart on any deal to save it here for quick access later."
          ctaLabel="Discover Deals"
          onPressCta={() => router.push('/(tabs)')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + BottomTabInset },
          ]}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="headline">Saved Deals</ThemedText>
          <View style={styles.dealsList}>
            {favoriteDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                brand={brandsById[deal.brandId]}
                onPress={() => router.push(`/deal/${deal.id}`)}
              />
            ))}
          </View>

          {followedBrands.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="headline">Followed Brands</ThemedText>
              <FlatList
                horizontal
                data={followedBrands}
                keyExtractor={(b) => b.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.brandRow}
                renderItem={({ item }) => (
                  <BrandCard brand={item} onPress={() => router.push(`/brand/${item.id}`)} />
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  dealsList: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  section: {
    gap: Spacing.three,
  },
  brandRow: {
    gap: Spacing.three,
  },
});
