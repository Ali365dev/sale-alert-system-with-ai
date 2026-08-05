import Ionicons from '@expo/vector-icons/Ionicons';
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
import { useOnboarding } from '@/state/onboarding';

const TOPICS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Fashion', icon: 'shirt-outline' },
  { label: 'Electronics', icon: 'phone-portrait-outline' },
  { label: 'Beauty', icon: 'sparkles-outline' },
  { label: 'Food', icon: 'restaurant-outline' },
  { label: 'Gaming', icon: 'game-controller-outline' },
  { label: 'Travel', icon: 'airplane-outline' },
  { label: 'Sports', icon: 'basketball-outline' },
];

export default function OnboardingTopicsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { topics, toggleTopic } = useOnboarding();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.five }]}
        showsVerticalScrollIndicator={false}>
        <ProgressDots step={0} total={3} />
        <ThemedText type="title" style={styles.title}>
          What are you into?
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Pick a few topics so we can personalize your deals.
        </ThemedText>

        <View style={styles.grid}>
          {TOPICS.map((t) => (
            <SelectableCard
              key={t.label}
              label={t.label}
              icon={t.icon}
              selected={topics.includes(t.label)}
              onPress={() => toggleTopic(t.label)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <SecondaryButton label="Skip" style={styles.skip} onPress={() => router.push('/onboarding/categories')} />
        <PrimaryButton
          label="Continue"
          disabled={topics.length === 0}
          style={styles.continueButton}
          onPress={() => router.push('/onboarding/categories')}
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
