import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useFavorites } from '@/state/favorites';
import { Deal } from '@/types/dealpulse';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoriteIds } = useFavorites();
  const { deals, brandsById } = useAppData();

  const favoriteDeals = useMemo(
    () => deals.filter((d) => favoriteIds.includes(d.id)),
    [deals, favoriteIds]
  );

  const sections = useMemo(() => {
    const byBrand = new Map<string, Deal[]>();
    for (const deal of favoriteDeals) {
      const brandName = brandsById[deal.brandId]?.name ?? 'Other';
      if (!byBrand.has(brandName)) byBrand.set(brandName, []);
      byBrand.get(brandName)!.push(deal);
    }
    return Array.from(byBrand.entries()).map(([title, data]) => ({ title, data }));
  }, [favoriteDeals, brandsById]);

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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + BottomTabInset },
          ]}
          ListHeaderComponent={
            <ThemedText type="title" style={styles.title}>
              Favorites
            </ThemedText>
          }
          renderSectionHeader={({ section }) => (
            <ThemedText type="headline" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          )}
          renderItem={({ item }) => (
            <DealCard
              deal={item}
              brand={brandsById[item.brandId]}
              onPress={() => router.push(`/deal/${item.id}`)}
              style={styles.card}
            />
          )}
        />
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
    gap: Spacing.three,
  },
  title: {
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  card: {
    marginBottom: Spacing.three,
  },
});
