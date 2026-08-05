import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { ProgressDots } from '@/components/dealpulse/progress-dots';
import { SecondaryButton } from '@/components/dealpulse/secondary-button';
import { SelectableCard } from '@/components/dealpulse/selectable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useOnboarding } from '@/state/onboarding';

const FALLBACK_CATEGORIES = ['Fashion', 'Electronics', 'Beauty', 'Food', 'Travel', 'Sports'];

export default function OnboardingCategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories: realCategories } = useAppData();
  const { categories, toggleCategory } = useOnboarding();

  const options =
    realCategories.length > 0 ? realCategories.map((c) => c.name) : FALLBACK_CATEGORIES;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.five }]}
        showsVerticalScrollIndicator={false}>
        <ProgressDots step={1} total={3} />
        <ThemedText type="title" style={styles.title}>
          Choose your categories
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          We'll prioritize deals from these categories first.
        </ThemedText>

        <View style={styles.grid}>
          {options.map((c) => (
            <SelectableCard
              key={c}
              label={c}
              selected={categories.includes(c)}
              onPress={() => toggleCategory(c)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <SecondaryButton label="Back" style={styles.skip} onPress={() => router.back()} />
        <PrimaryButton
          label="Continue"
          disabled={categories.length === 0}
          style={styles.continueButton}
          onPress={() => router.push('/onboarding/brands')}
        />
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
