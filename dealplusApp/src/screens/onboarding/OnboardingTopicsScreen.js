import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { buildDealPreferenceOptions } from '../../utils/dealPreferences';
import OnboardingProgress from '../../components/OnboardingProgress';
import OnboardingFooter from '../../components/OnboardingFooter';
import TipCard from '../../components/TipCard';

const MIN_SELECTED = 1;

const OnboardingTopicsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const apiCategories = useDataStore((state) => state.categories);
  const selected = usePreferencesStore((state) => state.favoriteCategories);
  const toggleCategory = usePreferencesStore((state) => state.toggleCategory);

  const options = useMemo(() => buildDealPreferenceOptions(apiCategories), [apiCategories]);
  const count = selected.length;
  const goNext = () => navigation.navigate('OnboardingCategoriesScreen');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.three, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={0} total={3} />

        <View style={styles.titleRow}>
          <Text style={styles.title}>Deal Preference</Text>
          <Icon name="sparkles" size={22} color="#F5CB1B" />
        </View>
        <Text style={styles.subtitle}>Select topics to personalize your deal feed.</Text>

        <View style={styles.chipWrap}>
          {options.map((item) => (
            <TipCard
              key={item.name}
              label={item.name}
              icon={item.icon}
              selected={selected.includes(item.name)}
              onPress={() => toggleCategory(item.name)}
            />
          ))}
        </View>
      </ScrollView>

      <OnboardingFooter
        onSkip={goNext}
        onContinue={goNext}
        continueLabel="Continue"
        disabled={count < MIN_SELECTED}
        selectedCount={count}
      />
    </View>
  );
};

export default OnboardingTopicsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      paddingHorizontal: SPACING.four,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: SPACING.four,
    },
    title: {
      flex: 1,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '800',
      letterSpacing: -0.6,
      color: colors.text,
    },
    subtitle: {
      marginTop: 12,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 28,
    },
  });
