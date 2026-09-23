import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import { buildDealPreferenceOptions } from '../../utils/dealPreferences';
import TipCard from '../../components/TipCard';

const MIN_SELECTED = 5;

const DealPreferenceScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const apiCategories = useDataStore((state) => state.categories);
  const selected = usePreferencesStore((state) => state.favoriteCategories);
  const toggleCategory = usePreferencesStore((state) => state.toggleCategory);

  const options = useMemo(() => buildDealPreferenceOptions(apiCategories), [apiCategories]);

  const count = selected.length;
  const canContinue = count >= MIN_SELECTED;

  const handleToggle = (name) => {
    toggleCategory(name);
    saveInterests({ categories: usePreferencesStore.getState().favoriteCategories });
  };

  const handleDone = () => {
    if (!canContinue) return;
    saveInterests({ categories: usePreferencesStore.getState().favoriteCategories });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + SPACING.two }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Deal Preference</Text>
          <Icon name="sparkles" size={22} color="#F5CB1B" />
        </View>
        <Text style={styles.subtitle}>
          Select at least {MIN_SELECTED} interests. No pressure, just pick what feels the most like you.
        </Text>

        <View style={styles.chipWrap}>
          {options.map((item) => {
            const active = selected.includes(item.name);
            return (
              <TipCard
                key={item.name}
                label={item.name}
                icon={item.icon}
                selected={active}
                onPress={() => handleToggle(item.name)}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handleDone}
          disabled={!canContinue}
          style={[styles.goBtn, !canContinue && styles.goBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Let's go">
          <Text style={styles.goLabel}>Let's go!</Text>
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>{count} selected</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export default DealPreferenceScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    topBar: {
      paddingHorizontal: SPACING.four,
      paddingBottom: SPACING.two,
    },
    content: {
      paddingHorizontal: SPACING.four,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: SPACING.two,
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
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 24,
      paddingTop: 12,
      backgroundColor: colors.surface,
    },
    goBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.chip,
      minHeight: 56,
      ...SHADOWS.button,
    },
    goBtnDisabled: {
      opacity: 0.4,
    },
    goLabel: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },
    countPill: {
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: RADIUS.chip,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    countLabel: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
  });
