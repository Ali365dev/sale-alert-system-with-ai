import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingProgress } from '@/components/dealpulse/onboarding-progress';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SelectableCard } from '@/components/dealpulse/selectable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useOnboarding } from '@/state/onboarding';

const TOPICS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Tech & Gadgets', icon: 'hardware-chip-outline' },
  { label: 'Outdoor Gear', icon: 'walk-outline' },
  { label: 'Home Decor', icon: 'bed-outline' },
  { label: 'Sustainable Living', icon: 'leaf-outline' },
  { label: 'Luxury Deals', icon: 'diamond-outline' },
];

export default function OnboardingTopicsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { topics, toggleTopic } = useOnboarding();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}
        showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={0} total={3} />

        <ThemedText type="title" style={styles.wordmark}>
          DealPulse
        </ThemedText>
        <ThemedText type="headline" style={styles.title}>
          What are you interested in?
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Select topics to personalize your deal feed.
        </ThemedText>

        <View style={styles.grid}>
          {TOPICS.map((t, i) => (
            <SelectableCard
              key={t.label}
              label={t.label}
              icon={t.icon}
              selected={topics.includes(t.label)}
              onPress={() => toggleTopic(t.label)}
              fullWidth={i === TOPICS.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable onPress={() => router.push('/onboarding/categories')} hitSlop={8}>
          <ThemedText type="default" themeColor="textSecondary">
            Skip
          </ThemedText>
        </Pressable>
        <PrimaryButton
          label="Continue"
          icon="arrow-forward"
          pill
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
  wordmark: {
    color: '#B7131A',
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  title: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  subtitle: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
  continueButton: {
    flex: 1,
  },
});
