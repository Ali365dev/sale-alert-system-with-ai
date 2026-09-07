import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import { usePressScale } from '../../hooks/usePressScale';
import BrandLogo from '../../components/BrandLogo';
import EmptyState from '../../components/EmptyState';
import AnimatedListItem from '../../components/AnimatedListItem';
import PrimaryButton from '../../components/PrimaryButton';

function BrandCard({ brand, selected, onPress, colors, styles }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.brandCard, selected && styles.brandCardSelected]}>
        <BrandLogo initials={brand.initials} logoUrl={brand.logoUrl} size={56} />
        <Text style={[styles.brandName, selected && styles.brandNameSelected]} numberOfLines={1}>
          {brand.name}
        </Text>
        <Icon name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={selected ? '#FFFFFF' : colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const FollowedBrandsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Followed Brands</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchBarWrap}>
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
            autoComplete="off"
            spellCheck={false}
            textContentType="none"
            importantForAutofill="no"
          />
        </View>
      </View>

      {brands.length === 0 ? (
        <EmptyState icon="business-outline" title="No brands tracked yet" body="Add brands in your backend and they'll appear here." />
      ) : filteredBrands.length === 0 ? (
        <View style={styles.requestWrap}>
          <Icon name="search-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.noResults}>No brands match "{query}".</Text>
          <Text style={styles.requestBody}>Can't find it? Let us know and we'll look into adding it.</Text>
          <PrimaryButton
            label={`Request "${query.trim()}"`}
            icon="add-circle-outline"
            pill
            onPress={() => navigation.navigate('RequestBrandScreen', { brandName: query.trim() })}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.five }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>Tap a brand to get instant alerts when they drop a new deal.</Text>
          <View style={styles.grid}>
            {filteredBrands.map((b, index) => (
              <AnimatedListItem key={b.id} index={index} style={styles.brandCardWrap}>
                <BrandCard brand={b} selected={followedBrands.includes(b.name)} onPress={() => handleToggle(b.name)} colors={colors} styles={styles} />
              </AnimatedListItem>
            ))}
          </View>
          <Pressable style={styles.requestLink} onPress={() => navigation.navigate('RequestBrandScreen')}>
            <Icon name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.requestLinkLabel}>Can't find a brand? Request it</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
};

export default FollowedBrandsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.text,
    },
    headerSpacer: {
      width: 24,
    },
    searchBarWrap: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.two,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      height: 48,
    },
    searchInput: {
      flex: 1,
      ...TYPOGRAPHY.default,
      color: colors.text,
      padding: 0,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: SPACING.two,
    },
    subtitle: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
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
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    brandCardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    brandName: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    brandNameSelected: {
      color: '#FFFFFF',
    },
    noResults: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    requestWrap: {
      alignItems: 'center',
      gap: SPACING.two,
      paddingHorizontal: SPACING.five,
      marginTop: SPACING.six,
    },
    requestBody: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.one,
    },
    requestLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.two,
      paddingVertical: SPACING.four,
    },
    requestLinkLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.primary,
    },
  });
