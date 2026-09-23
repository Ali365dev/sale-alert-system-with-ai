import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SCREEN_WIDTH, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useOnboardingStore from '../../state/onboardingStore';
import useOnboardingGateStore from '../../state/onboardingGateStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandCard from '../../components/BrandCard';
import EmptyState from '../../components/EmptyState';
import OnboardingProgress from '../../components/OnboardingProgress';
import OnboardingFooter from '../../components/OnboardingFooter';
import Logo from '../../components/Logo';
import Skeleton from '../../components/Skeleton';

const GRID_GAP = 12;
const COLS = 3;
const TILE = (SCREEN_WIDTH - SPACING.four * 2 - GRID_GAP * (COLS - 1)) / COLS;

const OnboardingBrandsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brands = useDataStore((state) => state.brands);
  const loading = useDataStore((state) => state.loading);
  const brandsById = useDataStore((state) => state.brandsById);
  const brandIds = useOnboardingStore((state) => state.brandIds);
  const toggleBrand = useOnboardingStore((state) => state.toggleBrand);
  const completeOnboarding = useOnboardingGateStore((state) => state.completeOnboarding);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);
  const setFollowedBrands = usePreferencesStore((state) => state.setFollowedBrands);
  const [query, setQuery] = useState('');

  const filteredBrands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const finish = () => {
    const brandNames = brandIds.map((id) => brandsById[id]?.name).filter(Boolean);
    setFollowedBrands(brandNames);
    saveInterests({ brands: brandNames, categories: favoriteCategories });
    completeOnboarding();
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const renderRows = (items) => {
    const rows = [];
    for (let i = 0; i < items.length; i += COLS) {
      rows.push(items.slice(i, i + COLS));
    }
    return rows.map((row, rowIndex) => (
      <View key={`row-${rowIndex}`} style={styles.row}>
        {row.map((b, colIndex) => (
          <AnimatedListItem key={b.id} index={rowIndex * COLS + colIndex} style={styles.tile}>
            <BrandCard
              variant="tile"
              brand={b}
              selected={brandIds.includes(b.id)}
              onPress={() => toggleBrand(b.id)}
            />
          </AnimatedListItem>
        ))}
        {row.length < COLS
          ? Array.from({ length: COLS - row.length }, (_, i) => <View key={`pad-${i}`} style={styles.tile} />)
          : null}
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Logo size={20} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={2} total={3} />
        <Text style={styles.title}>Follow brands you love</Text>
        <Text style={styles.subtitle}>Get instant alerts when they drop a new deal.</Text>

        <View style={styles.searchBar}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search brands..."
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        {loading && brands.length === 0 ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 9 }, (_, i) => (
              <View key={i} style={styles.tile}>
                <Skeleton width="100%" radius={18} style={styles.tileSkeleton} />
              </View>
            ))}
          </View>
        ) : !loading && brands.length === 0 ? (
          <EmptyState icon="business-outline" title="No brands tracked yet" body="Add brands in your backend and they'll appear here." />
        ) : filteredBrands.length === 0 ? (
          <Text style={styles.noResults}>No brands match "{query}".</Text>
        ) : (
          <View style={styles.grid}>{renderRows(filteredBrands)}</View>
        )}
      </ScrollView>

      <OnboardingFooter
        onSkip={finish}
        onContinue={finish}
        continueLabel="Get Started"
        selectedCount={brandIds.length}
      />
    </View>
  );
};

export default OnboardingBrandsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.four,
      paddingBottom: SPACING.two,
    },
    headerSpacer: {
      width: 24,
    },
    content: {
      paddingHorizontal: SPACING.four,
      gap: SPACING.two,
      paddingTop: SPACING.three,
      paddingBottom: SPACING.four,
    },
    title: {
      ...TYPOGRAPHY.title,
      color: colors.text,
      marginTop: SPACING.three,
    },
    subtitle: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      height: 48,
      marginTop: SPACING.three,
    },
    searchInput: {
      flex: 1,
      ...TYPOGRAPHY.default,
      color: colors.text,
      padding: 0,
    },
    grid: {
      marginTop: SPACING.four,
    },
    row: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP + 4,
    },
    tile: {
      width: TILE,
    },
    skeletonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
      marginTop: SPACING.four,
    },
    tileSkeleton: {
      aspectRatio: 1,
      height: undefined,
    },
    noResults: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: SPACING.six,
    },
  });
