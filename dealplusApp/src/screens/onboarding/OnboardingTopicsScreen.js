import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useOnboardingStore from '../../state/onboardingStore';
import OnboardingProgress from '../../components/OnboardingProgress';
import PrimaryButton from '../../components/PrimaryButton';
import SelectableCard from '../../components/SelectableCard';
import Logo from '../../components/Logo';

const TOPICS = [
  { label: 'Tech & Gadgets', icon: 'hardware-chip-outline' },
  { label: 'Outdoor Gear', icon: 'walk-outline' },
  { label: 'Home Decor', icon: 'bed-outline' },
  { label: 'Sustainable Living', icon: 'leaf-outline' },
  { label: 'Luxury Deals', icon: 'diamond-outline' },
];

const OnboardingTopicsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const topics = useOnboardingStore((state) => state.topics);
  const toggleTopic = useOnboardingStore((state) => state.toggleTopic);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.three }]} showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={0} total={3} />

        <Logo size={26} style={styles.wordmark} />
        <Text style={styles.title}>What are you interested in?</Text>
        <Text style={styles.subtitle}>Select topics to personalize your deal feed.</Text>

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

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.three }]}>
        <Pressable onPress={() => navigation.navigate('OnboardingCategoriesScreen')} hitSlop={8}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
        <PrimaryButton
          label="Continue"
          icon="arrow-forward"
          pill
          disabled={topics.length === 0}
          style={styles.continueButton}
          onPress={() => navigation.navigate('OnboardingCategoriesScreen')}
        />
      </View>
    </View>
  );
};

export default OnboardingTopicsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: SPACING.four,
      gap: SPACING.two,
    },
    wordmark: {
      alignSelf: 'center',
      marginTop: SPACING.four,
    },
    title: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
      textAlign: 'center',
      marginTop: SPACING.two,
    },
    subtitle: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: SPACING.four,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    skip: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
    },
    continueButton: {
      flex: 1,
    },
  });
