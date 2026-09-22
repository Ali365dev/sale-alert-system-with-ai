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

const MIN_SELECTED = 5;

const INTERESTS = [
  { name: 'Arts & Design', icon: 'color-palette-outline' },
  { name: 'Anime & Manga', icon: 'happy-outline' },
  { name: 'Videography', icon: 'videocam-outline' },
  { name: 'Afro-fiction', icon: 'book-outline' },
  { name: 'Tech', icon: 'phone-portrait-outline' },
  { name: 'Photography', icon: 'camera-outline' },
  { name: 'Books & Audio', icon: 'library-outline' },
  { name: 'Travel & Flights', icon: 'airplane-outline' },
  { name: 'Gaming & VR', icon: 'game-controller-outline' },
  { name: 'Coffee & Cafes', icon: 'cafe-outline' },
  { name: 'Luxury & Watches', icon: 'watch-outline' },
  { name: 'Beauty & Skincare', icon: 'sparkles-outline' },
  { name: 'Sneakers', icon: 'footsteps-outline' },
  { name: 'Home', icon: 'home-outline' },
  { name: 'Fashion', icon: 'shirt-outline' },
  { name: 'Food', icon: 'restaurant-outline' },
  { name: 'Sports', icon: 'football-outline' },
];

const ICON_MATCH = [
  { match: /art|design/i, icon: 'color-palette-outline' },
  { match: /anime|manga/i, icon: 'happy-outline' },
  { match: /video|film|movie/i, icon: 'videocam-outline' },
  { match: /book|audio|fiction/i, icon: 'library-outline' },
  { match: /tech|electronic|gadget/i, icon: 'phone-portrait-outline' },
  { match: /photo/i, icon: 'camera-outline' },
  { match: /travel|flight/i, icon: 'airplane-outline' },
  { match: /game|gaming|vr/i, icon: 'game-controller-outline' },
  { match: /coffee|cafe|food|dining/i, icon: 'cafe-outline' },
  { match: /watch|luxury|jewel/i, icon: 'watch-outline' },
  { match: /beauty|skin|cosmetic/i, icon: 'sparkles-outline' },
  { match: /sneaker|shoe|footwear/i, icon: 'footsteps-outline' },
  { match: /home|furniture/i, icon: 'home-outline' },
  { match: /fashion|apparel|clothing/i, icon: 'shirt-outline' },
  { match: /sport|fitness/i, icon: 'football-outline' },
];

const iconFor = (name, fallback) => ICON_MATCH.find((c) => c.match.test(name))?.icon ?? fallback ?? 'pricetag-outline';

const DealPreferenceScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const apiCategories = useDataStore((state) => state.categories);
  const selected = usePreferencesStore((state) => state.favoriteCategories);
  const toggleCategory = usePreferencesStore((state) => state.toggleCategory);

  const options = useMemo(() => {
    const seen = new Set(INTERESTS.map((i) => i.name.toLowerCase()));
    const extra = apiCategories
      .filter((c) => c.name && !seen.has(c.name.toLowerCase()))
      .map((c) => ({ name: c.name, icon: iconFor(c.name) }));
    return [...INTERESTS, ...extra];
  }, [apiCategories]);

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
          <Text style={styles.title}>What have you been{'\n'}loving lately?</Text>
          <Icon name="sparkles" size={22} color="#F5CB1B" />
        </View>
        <Text style={styles.subtitle}>
          Select at least {MIN_SELECTED} interests. No pressure, just pick what feels the most like you.
        </Text>

        <View style={styles.chipWrap}>
          {options.map((item) => {
            const active = selected.includes(item.name);
            return (
              <Pressable
                key={item.name}
                onPress={() => handleToggle(item.name)}
                style={[styles.chip, active && styles.chipSelected]}>
                <View style={[styles.iconBubble, active && styles.iconBubbleSelected]}>
                  <Icon name={item.icon} size={15} color={active ? colors.primary : colors.textSecondary} />
                </View>
                <Text style={[styles.chipLabel, active && styles.chipLabelSelected]}>{item.name}</Text>
              </Pressable>
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
      alignItems: 'flex-start',
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
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingVertical: 10,
      paddingLeft: 8,
      paddingRight: 14,
    },
    chipSelected: {
      backgroundColor: colors.primary,
    },
    iconBubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBubbleSelected: {
      backgroundColor: '#FFFFFF',
    },
    chipLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    chipLabelSelected: {
      color: '#FFFFFF',
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
