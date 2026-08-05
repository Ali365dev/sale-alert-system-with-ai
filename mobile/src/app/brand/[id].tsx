import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';

export default function BrandDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, deals } = useAppData();

  const brand = useMemo(() => brands.find((b) => b.id === id), [brands, id]);
  const brandDeals = useMemo(() => deals.filter((d) => d.brandId === id), [deals, id]);

  if (!brand) {
    return (
      <ThemedView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Brand not found"
          ctaLabel="Go Back"
          body=""
          onPressCta={() => router.back()}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={brandDeals}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}
        ListHeaderComponent={
          <>
            <View style={styles.cover}>
              <Image source={{ uri: brand.coverImage }} style={styles.coverImage} contentFit="cover" />
              <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
                <Pressable onPress={() => router.back()} style={styles.circleButton}>
                  <Ionicons name="chevron-back" size={22} color="#171717" />
                </Pressable>
              </View>
            </View>
            <View style={styles.header}>
              <ThemedText type="title">{brand.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {brand.dealCount} tracked offers
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
                {brand.description}
              </ThemedText>
              {brand.website && (
                <Pressable onPress={() => Linking.openURL(brand.website!)}>
                  <ThemedText type="linkPrimary">{brand.website}</ThemedText>
                </Pressable>
              )}
            </View>
            <ThemedText type="headline" style={styles.sectionTitle}>
              Current Offers
            </ThemedText>
          </>
        }
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            brand={brand}
            onPress={() => router.push(`/deal/${item.id}`)}
            style={styles.card}
          />
        )}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            No offers tracked for this brand yet.
          </ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.four,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  description: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  card: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  empty: {
    paddingHorizontal: Spacing.four,
  },
});
