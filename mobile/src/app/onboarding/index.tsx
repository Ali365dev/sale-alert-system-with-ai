import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

const heroImage = require('../../../assets/images/onboarding-hero.jpg');

export default function OnboardingWelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.four }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="flash" size={20} color="#FFFFFF" />
          </View>
          <ThemedText type="headline" style={styles.wordmark}>
            DealPulse
          </ThemedText>
        </View>

        <View style={styles.heroWrap}>
          <View style={styles.heroCard}>
            <Image source={heroImage} style={styles.heroImage} contentFit="cover" />
          </View>
          <View style={styles.offBadge}>
            <ThemedText type="smallBold" style={styles.offBadgeLabel}>
              50% OFF
            </ThemedText>
          </View>
          <View style={styles.flashBadge}>
            <ThemedText type="label" style={styles.flashBadgeLabel}>
              FLASH SALE
            </ThemedText>
          </View>
        </View>

        <ThemedText type="title" style={styles.headline}>
          All the best <ThemedText type="title" style={styles.headlineAccent}>brand deals</ThemedText> in
          one place.
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Discover exclusive discounts, promo codes, and limited-time offers from the brands you
          love. High stakes, huge savings.
        </ThemedText>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton
          label="Get Started"
          icon="arrow-forward"
          onPress={() => router.push('/onboarding/topics')}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.loginRow}>
          Already have an account? <ThemedText type="linkPrimary">Log in</ThemedText>
        </ThemedText>
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
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: Colors.light.primary,
  },
  heroWrap: {
    width: '100%',
    marginTop: Spacing.two,
    marginBottom: Spacing.six,
  },
  heroCard: {
    width: '100%',
    height: 260,
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFFFFF',
    ...Shadow.card,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  offBadge: {
    position: 'absolute',
    bottom: -14,
    left: -8,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.button,
    transform: [{ rotate: '-10deg' }],
    ...Shadow.raised,
  },
  offBadgeLabel: {
    color: '#171717',
  },
  flashBadge: {
    position: 'absolute',
    top: 16,
    right: -8,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.button - 6,
    transform: [{ rotate: '6deg' }],
    ...Shadow.card,
  },
  flashBadgeLabel: {
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headline: {
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  headlineAccent: {
    color: Colors.light.primary,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  loginRow: {
    textAlign: 'center',
  },
});
