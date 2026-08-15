import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const LAST_UPDATED = 'January 2026';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Information we collect',
    body:
      'DealPulse stores the brands you follow, the categories you favorite, and the alerts you create locally on your device so the app can personalize your deal feed. We do not require you to create an account or provide personal information to use the app.',
  },
  {
    title: 'How we use information',
    body:
      'Your saved preferences (followed brands, favorite categories, tracked alerts) are used only to determine which deals are shown to you and when to notify you of a matching offer.',
  },
  {
    title: 'Data sharing',
    body:
      'We do not sell your data. DealPulse does not share your on-device preferences with third parties.',
  },
  {
    title: 'Data retention',
    body:
      'Your preferences remain on your device until you clear the app’s storage or uninstall the app.',
  },
  {
    title: 'Contact us',
    body: 'Questions about this policy can be sent to [contact email].',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <ThemedText type="headline">Privacy Policy</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.draftBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#B7131A" />
          <ThemedText type="small" style={styles.draftBannerText}>
            Draft template &mdash; replace the bracketed placeholders and have this reviewed
            before publishing. Play Console also requires this policy to be hosted at a public
            URL, not only shown in-app.
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Last updated: {LAST_UPDATED}
        </ThemedText>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <ThemedText type="subtitle">{section.title}</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {section.body}
            </ThemedText>
          </View>
        ))}
      </ScrollView>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  draftBanner: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: '#FDEEEE',
    borderRadius: 12,
    padding: Spacing.three,
  },
  draftBannerText: {
    flex: 1,
  },
  section: {
    gap: Spacing.one,
  },
});
