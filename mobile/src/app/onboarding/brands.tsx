import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { ProgressDots } from '@/components/dealpulse/progress-dots';
import { SecondaryButton } from '@/components/dealpulse/secondary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useOnboarding } from '@/state/onboarding';

export default function OnboardingBrandsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, loading } = useAppData();
  const { brandIds, toggleBrand } = useOnboarding();

  const finish = () => router.replace('/(tabs)');

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.five }]}
        showsVerticalScrollIndicator={false}>
        <ProgressDots step={2} total={3} />
        <ThemedText type="title" style={styles.title}>
          Follow your favorite brands
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Pulled straight from your tracked brands — pick the ones you care about most.
        </ThemedText>

        {!loading && brands.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="No brands tracked yet"
            body="Add brands in your backend and they'll appear here."
          />
        ) : (
          <View style={styles.grid}>
            {brands.map((b) => {
              const selected = brandIds.includes(b.id);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => toggleBrand(b.id)}
                  style={[styles.brandCard, selected && styles.brandCardSelected]}>
                  <BrandLogo initials={b.initials} size={48} />
                  <ThemedText type="small" numberOfLines={1} style={styles.brandName}>
                    {b.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <SecondaryButton label="Back" style={styles.skip} onPress={() => router.back()} />
        <PrimaryButton label="Get Started" style={styles.continueButton} onPress={finish} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    marginTop: Spacing.four,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  brandCard: {
    width: 90,
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  brandCardSelected: {
    borderColor: '#171717',
    backgroundColor: '#F5F5F5',
  },
  brandName: {
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  skip: {
    flex: 1,
  },
  continueButton: {
    flex: 2,
  },
});
