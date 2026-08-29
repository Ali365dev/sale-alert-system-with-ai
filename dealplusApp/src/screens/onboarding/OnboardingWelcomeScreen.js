import { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import PrimaryButton from '../../components/PrimaryButton';
import Logo from '../../components/Logo';

const heroImage = require('../../assets/images/onboarding-hero.jpg');

const OnboardingWelcomeScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.four }]} showsVerticalScrollIndicator={false}>
        <Logo size={24} style={styles.logoRow} />

        <View style={styles.heroWrap}>
          <View style={styles.heroCard}>
            <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
          </View>
          <View style={styles.offBadge}>
            <Text style={styles.offBadgeLabel}>50% OFF</Text>
          </View>
          <View style={styles.flashBadge}>
            <Text style={styles.flashBadgeLabel}>FLASH SALE</Text>
          </View>
        </View>

        <Text style={styles.headline}>
          All the best <Text style={styles.headlineAccent}>brand deals</Text> in one place.
        </Text>
        <Text style={styles.subtitle}>
          Discover exclusive discounts, promo codes, and limited-time offers from the brands you love. High stakes, huge savings.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.three }]}>
        <PrimaryButton label="Get Started" icon="arrow-forward" onPress={() => navigation.navigate('OnboardingTopicsScreen')} />
        <Text style={styles.loginRow}>
          Already have an account? <Text style={styles.loginLink}>Log in</Text>
        </Text>
      </View>
    </View>
  );
};

export default OnboardingWelcomeScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: SPACING.four,
      alignItems: 'center',
    },
    logoRow: {
      marginBottom: SPACING.five,
    },
    heroWrap: {
      width: '100%',
      marginTop: SPACING.two,
      marginBottom: SPACING.six,
    },
    heroCard: {
      width: '100%',
      height: 260,
      borderRadius: RADIUS.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...SHADOWS.card,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    offBadge: {
      position: 'absolute',
      bottom: -14,
      left: -8,
      backgroundColor: colors.accent,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
      borderRadius: RADIUS.button,
      transform: [{ rotate: '-10deg' }],
      ...SHADOWS.raised,
    },
    offBadgeLabel: {
      ...TYPOGRAPHY.smallBold,
      color: '#171717',
    },
    flashBadge: {
      position: 'absolute',
      top: 16,
      right: -8,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.three,
      paddingVertical: 6,
      borderRadius: RADIUS.button - 6,
      transform: [{ rotate: '6deg' }],
      ...SHADOWS.card,
    },
    flashBadgeLabel: {
      ...TYPOGRAPHY.label,
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    headline: {
      ...TYPOGRAPHY.title,
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.three,
    },
    headlineAccent: {
      color: colors.primary,
    },
    subtitle: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: SPACING.two,
    },
    footer: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: SPACING.two,
    },
    loginRow: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loginLink: {
      ...TYPOGRAPHY.linkPrimary,
    },
  });
