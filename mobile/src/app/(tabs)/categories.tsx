import { useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryCard } from '@/components/dealpulse/category-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories, loading, refresh } = useAppData();

  if (!loading && categories.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <TopAppBar />
        <EmptyState
          icon="grid-outline"
          title="No categories yet"
          body="Categories appear here once your backend has tracked offers with a category."
          ctaLabel="Refresh"
          onPressCta={refresh}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <TopAppBar />
      <FlatList
        data={categories}
        keyExtractor={(c) => c.name}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + BottomTabInset },
        ]}
        ListHeaderComponent={
          <ThemedText type="title" style={styles.title}>
            Categories
          </ThemedText>
        }
        renderItem={({ item }) => (
          <CategoryCard
            category={item}
            onPress={() => router.push(`/search?category=${item.name}`)}
          />
        )}
      />
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
  row: {
    gap: Spacing.three,
  },
  title: {
    marginBottom: Spacing.two,
  },
});
