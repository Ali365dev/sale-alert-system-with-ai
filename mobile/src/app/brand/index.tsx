import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { SearchBar } from '@/components/dealpulse/search-bar';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';

export default function BrandDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, loading, refresh } = useAppData();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name));
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  return (
    <ThemedView style={styles.container}>
      <TopAppBar showBack hideSearch />
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search brands" />
      </View>

      {!loading && brands.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No brands tracked yet"
          body="Brands you track in your backend will show up here."
          ctaLabel="Refresh"
          onPressCta={refresh}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
          renderItem={({ item }) => (
            <Pressable style={styles.item} onPress={() => router.push(`/brand/${item.id}`)}>
              <BrandLogo initials={item.initials} size={64} />
              <ThemedText type="small" numberOfLines={1} style={styles.name}>
                {item.name}
              </ThemedText>
            </Pressable>
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
  searchWrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  item: {
    alignItems: 'center',
    gap: Spacing.two,
    width: 84,
  },
  name: {
    textAlign: 'center',
  },
});
