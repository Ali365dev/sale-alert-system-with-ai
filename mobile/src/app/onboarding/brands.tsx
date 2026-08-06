import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SecondaryButton } from '@/components/dealpulse/secondary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useOnboarding } from '@/state/onboarding';

const PAGE_SIZE = 5;

export default function OnboardingBrandsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, loading } = useAppData();
  const { brandIds, toggleBrand } = useOnboarding();
  const [showAll, setShowAll] = useState(false);

  const visibleBrands = showAll ? brands : brands.slice(0, PAGE_SIZE);
  const hasMore = !showAll && brands.length > PAGE_SIZE;

  const finish = () => router.replace('/(tabs)');

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <View style={styles.progressTrack} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.title}>
          Follow brands you love
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Get instant alerts when they drop a new deal.
        </ThemedText>

        {!loading && brands.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="No brands tracked yet"
            body="Add brands in your backend and they'll appear here."
          />
        ) : (
          <View style={styles.grid}>
            {visibleBrands.map((b) => {
              const selected = brandIds.includes(b.id);
              return (
                <View key={b.id} style={styles.brandCard}>
                  <BrandLogo initials={b.initials} size={64} />
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {b.name}
                  </ThemedText>
                  <SecondaryButton
                    label={selected ? 'Following' : 'Follow'}
                    icon={selected ? 'checkmark' : 'add'}
                    variant="outline"
                    style={styles.followButton}
                    onPress={() => toggleBrand(b.id)}
                  />
                </View>
              );
            })}
            {hasMore && (
              <Pressable style={styles.viewMoreCard} onPress={() => setShowAll(true)}>
                <ThemedText type="headline" themeColor="textSecondary">
                  •••
                </ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  View More
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton label="Get Started" icon="arrow-forward" pill onPress={finish} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B7131A',
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  title: {
    color: '#B7131A',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  brandCard: {
    width: '48%',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    backgroundColor: '#FFFFFF',
  },
  followButton: {
    marginTop: Spacing.one,
    alignSelf: 'stretch',
  },
  viewMoreCard: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    minHeight: 140,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
});
