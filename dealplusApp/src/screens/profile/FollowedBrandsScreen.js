import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import { usePressScale } from '../../hooks/usePressScale';
import BrandLogo from '../../components/BrandLogo';
import EmptyState from '../../components/EmptyState';

function BrandCard({ brand, selected, onPress }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={[animatedStyle, styles.brandCardWrap]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.brandCard, selected && styles.brandCardSelected]}>
        <BrandLogo initials={brand.initials} size={56} />
        <Text style={[styles.brandName, selected && styles.brandNameSelected]} numberOfLines={1}>
          {brand.name}
        </Text>
        <Icon name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={selected ? '#FFFFFF' : COLORS.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const FollowedBrandsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const brands = useDataStore((state) => state.brands);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const toggleFollowedBrand = usePreferencesStore((state) => state.toggleFollowedBrand);
  const [query, setQuery] = useState('');

  const filteredBrands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const handleToggle = (name) => {
    toggleFollowedBrand(name);
    saveInterests({ brands: usePreferencesStore.getState().followedBrands });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <Text style={styles.headerTitle}>Followed Brands</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchBarWrap}>
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
      </View>

      {brands.length === 0 ? (
        <EmptyState icon="business-outline" title="No brands tracked yet" body="Add brands in your backend and they'll appear here." />
      ) : filteredBrands.length === 0 ? (
        <Text style={styles.noResults}>No brands match "{query}".</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.five }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>Tap a brand to get instant alerts when they drop a new deal.</Text>
          <View style={styles.grid}>
            {filteredBrands.map((b) => (
              <BrandCard key={b.id} brand={b} selected={followedBrands.includes(b.name)} onPress={() => handleToggle(b.name)} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default FollowedBrandsScreen;

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
  headerTitle: {
    ...TYPOGRAPHY.subtitle,
  },
  headerSpacer: {
    width: 24,
  },
  searchBarWrap: {
    paddingHorizontal: SPACING.four,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    height: 48,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.default,
    color: COLORS.text,
    padding: 0,
  },
  content: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    gap: SPACING.two,
  },
  subtitle: {
    ...TYPOGRAPHY.default,
    color: COLORS.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SPACING.three,
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
  noResults: {
    ...TYPOGRAPHY.default,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.six,
  },
});
