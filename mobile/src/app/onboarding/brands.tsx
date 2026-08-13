import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { OnboardingProgress } from '@/components/dealpulse/onboarding-progress';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { Skeleton } from '@/components/dealpulse/skeleton';
import { usePressScale } from '@/components/dealpulse/use-press-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useOnboarding } from '@/state/onboarding';
import { useOnboardingGate } from '@/state/onboarding-gate';
import { Brand } from '@/types/dealpulse';

function BrandCard({
  brand,
  selected,
  onPress,
}: {
  brand: Brand;
  selected: boolean;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={[animatedStyle, styles.brandCardWrap]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.brandCard, selected && styles.brandCardSelected]}>
        <BrandLogo initials={brand.initials} size={64} />
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={selected ? styles.brandNameSelected : undefined}>
          {brand.name}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

export default function OnboardingBrandsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, loading } = useAppData();
  const { brandIds, toggleBrand } = useOnboarding();
  const { completeOnboarding } = useOnboardingGate();
  const [query, setQuery] = useState('');

  const filteredBrands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <ThemedText type="headline" style={styles.wordmark}>
          DealPulse
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={2} total={3} />
        <ThemedText type="title" style={styles.title}>
          Follow brands you love
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Get instant alerts when they drop a new deal.
        </ThemedText>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search brands..."
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        {loading && brands.length === 0 ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.brandCardWrap}>
                <View style={styles.brandCard}>
                  <Skeleton width={64} height={64} radius={32} />
                  <Skeleton width={56} height={14} style={styles.gapTop} />
                </View>
              </View>
            ))}
          </View>
        ) : !loading && brands.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="No brands tracked yet"
            body="Add brands in your backend and they'll appear here."
          />
        ) : filteredBrands.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.noResults}>
            No brands match &ldquo;{query}&rdquo;.
          </ThemedText>
        ) : (
          <View style={styles.grid}>
            {filteredBrands.map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                selected={brandIds.includes(b.id)}
                onPress={() => toggleBrand(b.id)}
              />
            ))}
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  headerSpacer: {
    width: 24,
  },
  wordmark: {
    color: '#B7131A',
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  title: {
    marginTop: Spacing.three,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    height: 48,
    marginTop: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#171717',
    padding: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
  },
  brandCardWrap: {
    width: '48%',
    marginBottom: Spacing.three,
  },
  brandCard: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    backgroundColor: '#FFFFFF',
  },
  brandCardSelected: {
    backgroundColor: '#B7131A',
    borderColor: '#B7131A',
  },
  brandNameSelected: {
    color: '#FFFFFF',
  },
  gapTop: {
    marginTop: Spacing.two,
  },
  noResults: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
});
