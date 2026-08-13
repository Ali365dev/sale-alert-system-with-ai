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
import { useAppData } from '@/state/data';
import { usePreferences } from '@/state/preferences';

const FALLBACK_CATEGORIES = ['Fashion', 'Electronics', 'Beauty', 'Food', 'Travel', 'Sports'];

const ICONS: { match: RegExp; icon: keyof typeof Ionicons.glyphMap }[] = [
  { match: /fashion|apparel|clothing|retail/i, icon: 'shirt-outline' },
  { match: /electronic|software|tech/i, icon: 'laptop-outline' },
  { match: /beauty|cosmetic|personal care|skincare/i, icon: 'happy-outline' },
  { match: /food|restaurant|grocery|dining/i, icon: 'restaurant-outline' },
  { match: /travel/i, icon: 'airplane-outline' },
  { match: /sport|fitness|outdoor/i, icon: 'football-outline' },
  { match: /home|furniture|garden/i, icon: 'home-outline' },
  { match: /gaming|game|entertainment|movie|music/i, icon: 'game-controller-outline' },
  { match: /news|media/i, icon: 'newspaper-outline' },
  { match: /footwear|shoe/i, icon: 'footsteps-outline' },
  { match: /web|digital|service/i, icon: 'globe-outline' },
  { match: /pet|animal/i, icon: 'paw-outline' },
  { match: /book|education|learning/i, icon: 'book-outline' },
  { match: /health|wellness|medical/i, icon: 'medkit-outline' },
  { match: /automotive|car|vehicle/i, icon: 'car-outline' },
  { match: /jewelry|jewellery|accessor|watch/i, icon: 'diamond-outline' },
  { match: /baby|kid|toy/i, icon: 'gift-outline' },
  { match: /office|stationery/i, icon: 'briefcase-outline' },
];
const DEFAULT_ICON: keyof typeof Ionicons.glyphMap = 'pricetag-outline';

function iconFor(name: string): keyof typeof Ionicons.glyphMap {
  return ICONS.find((c) => c.match.test(name))?.icon ?? DEFAULT_ICON;
}

export default function OnboardingCategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories: realCategories } = useAppData();
  const { favoriteCategories, toggleCategory } = usePreferences();

  const options =
    realCategories.length > 0 ? realCategories.map((c) => c.name) : FALLBACK_CATEGORIES;

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
        <OnboardingProgress step={1} total={3} />
        <ThemedText type="title" style={styles.title}>
          Choose your favorites
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Select the categories you want to see deals for.
        </ThemedText>

        <View style={styles.grid}>
          {options.map((c) => (
            <SelectableCard
              key={c}
              label={c}
              icon={iconFor(c)}
              iconVariant="circle"
              selected={favoriteCategories.includes(c)}
              onPress={() => toggleCategory(c)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton
          label="Next"
          icon="arrow-forward"
          disabled={favoriteCategories.length === 0}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
});
