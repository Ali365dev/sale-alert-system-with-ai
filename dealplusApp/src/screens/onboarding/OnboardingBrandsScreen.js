import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import useOnboardingStore from '../../state/onboardingStore';
import useOnboardingGateStore from '../../state/onboardingGateStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import { usePressScale } from '../../hooks/usePressScale';
import BrandLogo from '../../components/BrandLogo';
import EmptyState from '../../components/EmptyState';
import OnboardingProgress from '../../components/OnboardingProgress';
import PrimaryButton from '../../components/PrimaryButton';
import Logo from '../../components/Logo';
import Skeleton from '../../components/Skeleton';

function BrandCard({ brand, selected, onPress }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={[animatedStyle, styles.brandCardWrap]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.brandCard, selected && styles.brandCardSelected]}>
        <BrandLogo initials={brand.initials} size={64} />
        <Text style={[styles.brandName, selected && styles.brandNameSelected]} numberOfLines={1}>
          {brand.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const OnboardingBrandsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <Logo size={20} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={2} total={3} />
        <Text style={styles.title}>Follow brands you love</Text>
        <Text style={styles.subtitle}>Get instant alerts when they drop a new deal.</Text>

        <View style={styles.searchBar}>
          <Icon name="search" size={18} color="#6B7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search brands..."
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        {loading && brands.length === 0 ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.brandCardWrap}>
                <View style={styles.brandCard}>
                  <Skeleton width={64} height={64} radius={32} />
                  <Skeleton width={56} height={14} style={styles.gapTop} />
                </View>
              </View>
            ))}
          </View>
        ) : !loading && brands.length === 0 ? (
          <EmptyState icon="business-outline" title="No brands tracked yet" body="Add brands in your backend and they'll appear here." />
        ) : filteredBrands.length === 0 ? (
          <Text style={styles.noResults}>No brands match "{query}".</Text>
        ) : (
          <View style={styles.grid}>
            {filteredBrands.map((b) => (
              <BrandCard key={b.id} brand={b} selected={brandIds.includes(b.id)} onPress={() => toggleBrand(b.id)} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.three }]}>
        <PrimaryButton label="Get Started" icon="arrow-forward" pill onPress={finish} />
      </View>
    </View>
  );
};

export default OnboardingBrandsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  },
  title: {
    ...TYPOGRAPHY.title,
    marginTop: SPACING.three,
  },
  subtitle: {
    ...TYPOGRAPHY.default,
    color: COLORS.textSecondary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    height: 48,
    marginTop: SPACING.three,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.default,
    color: COLORS.text,
    padding: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SPACING.four,
  },
  brandCardWrap: {
    width: '48%',
    marginBottom: SPACING.three,
  },
  brandCard: {
    alignItems: 'center',
    gap: SPACING.two,
    padding: SPACING.three,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  brandCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  brandName: {
    ...TYPOGRAPHY.smallBold,
  },
  brandNameSelected: {
    color: '#FFFFFF',
  },
  gapTop: {
    marginTop: SPACING.two,
  },
  noResults: {
    ...TYPOGRAPHY.default,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.six,
  },
  footer: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
