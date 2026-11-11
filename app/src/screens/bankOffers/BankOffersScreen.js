import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useBankCardsStore from '../../state/bankCardsStore';
import useBankOffersStore from '../../state/bankOffersStore';
import { loadBankCardOffers } from '../../services/bankOffersApi';
import Geolocation from '@react-native-community/geolocation';
import BrandLogo from '../../components/BrandLogo';
import FilterPickerSheet from '../../components/FilterPickerSheet';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';
import { requestLocationPermission } from '../../services/regionDetection';
import {
  SUPPORTED_BANKS,
  BANK_CARD_OFFERS,
  getBrandSlugsForBank,
  getMaxDiscountForBrand,
} from '../../config/banks';

const { width: SCREEN_W } = Dimensions.get('window');
const PAD = 16;
const CARD_H = 170;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: null },
  { id: 'dining', label: 'Dining', icon: 'restaurant-outline' },
  { id: 'grocery', label: 'Grocery', icon: 'cart-outline' },
  { id: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-outline' },
  { id: 'health', label: 'Health', icon: 'heart-outline' },
  { id: 'entertainment', label: 'Entertainment', icon: 'tv-outline' },
  { id: 'other', label: 'Other', icon: 'pricetag-outline' },
];

const CATEGORY_MATCH = {
  dining: /dining|food|restaurant|cafe|bakery/i,
  grocery: /grocery|supermarket|hypermarket/i,
  travel: /travel|hotel|flight/i,
  shopping: /fashion|apparel|clothing|retail|shopping|accessories/i,
  health: /health|pharma|beauty|cosmetic|wellness/i,
  entertainment: /entertainment|cinema|movie|gaming|leisure|sport/i,
};

const isOtherCategory = (category) =>
  !Object.values(CATEGORY_MATCH).some((pattern) => pattern.test(category || ''));

const SORT_OPTIONS = [
  { id: 'popular', label: 'Popular (most reviews)' },
  { id: 'discount', label: 'Most discount' },
];

const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const CITY_OPTIONS = [
  { id: null,         label: 'All cities' },
  { id: 'nearby',     label: 'Near me',    icon: 'navigate-outline' },
  { id: 'karachi',    label: 'Karachi',    count: 1116 },
  { id: 'lahore',     label: 'Lahore',     count: 956 },
  { id: 'islamabad',  label: 'Islamabad',  count: 660 },
  { id: 'faisalabad', label: 'Faisalabad', count: 344 },
  { id: 'multan',     label: 'Multan',     count: 331 },
  { id: 'rawalpindi', label: 'Rawalpindi', count: 290 },
  { id: 'hyderabad',  label: 'Hyderabad',  count: 198 },
  { id: 'peshawar',   label: 'Peshawar',   count: 176 },
  { id: 'quetta',     label: 'Quetta',     count: 134 },
  { id: 'sialkot',    label: 'Sialkot',    count: 118 },
];

function BrandOfferCard({ brand, maxDiscount, offers = BANK_CARD_OFFERS, onPress }) {
  const { colors } = useTheme();
  const discountText = maxDiscount ? `Up to ${maxDiscount}% off` : 'Up to 20% off';
  const bankCount = offers.filter((o) => o.brandSlug === brand.id).length || '8+';
  const cardOffers = brand.dealCount || bankCount;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${brand.name} bank card offers`}>

      {/* Cover image */}
      <View style={styles.coverWrap}>
        <Image
          source={{ uri: brand.coverImage }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        {/* Bottom scrim so discount text is readable */}
        <View style={styles.coverScrim} />

        {/* Discount — bottom left */}
        <Text style={styles.discountText}>{discountText}</Text>

        {/* Banks count pill — bottom right */}
        <View style={styles.banksPill}>
          <Text style={styles.banksPillText}>{bankCount} banks</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.cardFooter, { backgroundColor: colors.surface }]}>
        {/* Row 1: logo + name */}
        <View style={styles.footerRow}>
          <BrandLogo brand={brand} size={36} tone="filled" fit="cover" elevated />
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
            {brand.name}
          </Text>
        </View>

        {/* Row 2: category meta */}
        <View style={styles.metaRow}>
          <Icon name="pricetag-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {brand.category}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Row 3: card offers count */}
        <View style={styles.metaRow}>
          <Icon name="card-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {cardOffers} card offers
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function BrandOfferCardGrid({ brand, maxDiscount, onPress }) {
  const { colors } = useTheme();
  const discountText = maxDiscount ? `Up to ${maxDiscount}% off` : 'Up to 20% off';
  return (
    <Pressable
      style={[stylesGrid.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${brand.name} bank card offers`}>
      {/* Mini cover */}
      <View style={stylesGrid.cover}>
        <Image source={{ uri: brand.coverImage }} style={stylesGrid.coverImg} resizeMode="cover" />
        <View style={stylesGrid.scrim} />
        <Text style={stylesGrid.discountText} numberOfLines={1}>{discountText}</Text>
      </View>
      {/* Footer */}
      <View style={stylesGrid.footer}>
        <BrandLogo brand={brand} size={28} tone="filled" fit="cover" elevated />
        <Text style={[stylesGrid.name, { color: colors.text }]} numberOfLines={1}>{brand.name}</Text>
      </View>
      <Text style={[stylesGrid.meta, { color: colors.textSecondary }]} numberOfLines={1}>{brand.category}</Text>
    </Pressable>
  );
}

const GRID_COL_GAP = 10;
const GRID_COLS = 2;

const stylesGrid = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: 100, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, backgroundColor: 'rgba(0,0,0,0.5)' },
  discountText: { position: 'absolute', bottom: 6, left: 8, fontSize: 11, fontWeight: '800', color: '#FFF' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8 },
  name: { fontSize: 12, fontWeight: '800', flex: 1 },
  meta: { fontSize: 11, paddingHorizontal: 10, paddingBottom: 8, marginTop: 2 },
});

export default function BankOffersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const brands = useDataStore((s) => s.brands);
  const deals = useDataStore((s) => s.deals);
  const savedCards = useBankCardsStore((s) => s.cards);
  const fetchedBankOffers = useBankOffersStore((s) => s.offers);

  const [gridView, onViewChange] = useViewMode(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeBank, setActiveBank] = useState(null);
  const [sortMode, setSortMode] = useState('popular');
  const [onlyMyCards, setOnlyMyCards] = useState(false);
  const [activeCity, setActiveCity] = useState(null);
  const [nearbyCity, setNearbyCity] = useState(null); // resolved city id when "nearby" is active
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const citySheetRef = useRef(null);
  const bankSheetRef = useRef(null);
  const sortSheetRef = useRef(null);

  const resolveNearbyCity = useCallback(async () => {
    setNearbyLoading(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) { setNearbyLoading(false); return; }
      await new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          async ({ coords: { latitude, longitude } }) => {
            try {
              const res = await fetch(
                `${REVERSE_GEOCODE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
              );
              if (res.ok) {
                const data = await res.json();
                const city = (data?.city || data?.locality || '').toLowerCase();
                const match = CITY_OPTIONS.find(
                  (c) => c.id && c.id !== 'nearby' && city.includes(c.id),
                );
                setNearbyCity(match?.id ?? null);
              }
            } catch { /* silent */ }
            resolve();
          },
          () => resolve(),
          { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
        );
      });
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const handleCitySelect = useCallback((id) => {
    setActiveCity(id);
    if (id === 'nearby') {
      resolveNearbyCity();
    } else {
      setNearbyCity(null);
    }
  }, [resolveNearbyCity]);

  const bankOptions = useMemo(
    () => [
      { id: null, label: 'All banks' },
      ...SUPPORTED_BANKS.map((b) => ({ id: b.id, label: b.name, color: b.color })),
    ],
    [],
  );

  useEffect(() => {
    loadBankCardOffers();
  }, []);

  // Live, scraped offers (takhfif.app) layered on top of the static seed
  // array — see services/bankOffersApi.js.
  const combinedOffers = useMemo(
    () => [...BANK_CARD_OFFERS, ...fetchedBankOffers],
    [fetchedBankOffers],
  );

  const qualifyingCardBanks = useMemo(
    () => new Set(savedCards.map((c) => c.bankId)),
    [savedCards],
  );

  const filteredBrands = useMemo(() => {
    let list = brands;

    // Bank filter: only brands that have offers for the selected bank
    if (activeBank) {
      const allowedSlugs = new Set(getBrandSlugsForBank(activeBank, combinedOffers));
      list = list.filter((b) => allowedSlugs.has(b.id));
    }

    // Only my cards filter
    if (onlyMyCards) {
      list = list.filter((b) =>
        combinedOffers.some(
          (o) => o.brandSlug === b.id && qualifyingCardBanks.has(o.bankId),
        ),
      );
    }

    // Category filter
    if (activeCategory === 'other') {
      list = list.filter((b) => isOtherCategory(b.category));
    } else if (activeCategory !== 'all') {
      const pattern = CATEGORY_MATCH[activeCategory];
      if (pattern) {
        list = list.filter((b) => pattern.test(b.category));
      }
    }

    // Sort
    if (sortMode === 'discount') {
      list = [...list].sort((a, b) => {
        const da = getMaxDiscountForBrand(a.id, activeBank, combinedOffers) || 0;
        const db = getMaxDiscountForBrand(b.id, activeBank, combinedOffers) || 0;
        return db - da;
      });
    }

    return list;
  }, [brands, activeBank, activeCategory, combinedOffers, onlyMyCards, sortMode, qualifyingCardBanks]);

  const getMaxDiscount = (brand) => {
    const specific = getMaxDiscountForBrand(brand.id, activeBank || null, combinedOffers);
    if (specific) return specific;
    // Fallback: max discount from existing deals
    const brandDeals = deals.filter((d) => d.brandId === brand.id && d.isPercentageOff);
    if (brandDeals.length) {
      const max = Math.max(...brandDeals.map((d) => parseInt(String(d.discountLabel || '0').replace(/[^0-9]/g, ''), 10) || 0));
      if (max > 0) return max;
    }
    return null;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.appName, { color: colors.textSecondary }]}>Deals More</Text>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Bank Card Offers</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            hitSlop={8}
            onPress={() => navigation.navigate('MyCardsScreen')}
            style={[styles.topBtn, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="My cards">
            <Icon name="card-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => navigation.navigate('SearchScreen')}
            style={[styles.topBtn, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Search">
            <Icon name="search-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        style={styles.chipsScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}>
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[
                styles.chip,
                { backgroundColor: active ? PRIMARY : colors.surface, borderColor: active ? PRIMARY : colors.border },
              ]}>
              {cat.icon ? (
                <Icon name={cat.icon} size={12} color={active ? '#FFFFFF' : colors.text} style={{ marginRight: 4 }} />
              ) : null}
              <Text style={[styles.chipLabel, { color: active ? '#FFFFFF' : colors.text }]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Filter bar: banks | sort | only my cards */}
      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}>

        {/* City picker */}
        <Pressable
          onPress={() => citySheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel="Filter by city"
          style={[styles.filterPill, { borderColor: activeCity ? PRIMARY : colors.border, backgroundColor: colors.surface }]}>
          {activeCity === 'nearby' ? (
            <Icon name={nearbyLoading ? 'sync-outline' : 'navigate'} size={12} color={PRIMARY} style={{ marginRight: 4 }} />
          ) : null}
          <Text style={[styles.filterPillText, { color: activeCity ? PRIMARY : colors.text }]} numberOfLines={1}>
            {activeCity === 'nearby'
              ? (nearbyLoading ? 'Locating…' : nearbyCity ? CITY_OPTIONS.find((c) => c.id === nearbyCity)?.label ?? 'Near me' : 'Near me')
              : activeCity ? CITY_OPTIONS.find((c) => c.id === activeCity)?.label : 'All cities'}
          </Text>
          <Icon name="chevron-down" size={12} color={activeCity ? PRIMARY : colors.textSecondary} />
        </Pressable>

        {/* Bank picker */}
        <Pressable
          onPress={() => bankSheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel="Filter by bank"
          style={[styles.filterPill, { borderColor: activeBank ? PRIMARY : colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.filterPillText, { color: activeBank ? PRIMARY : colors.text }]} numberOfLines={1}>
            {activeBank ? SUPPORTED_BANKS.find((b) => b.id === activeBank)?.name : 'All banks'}
          </Text>
          <Icon name="chevron-down" size={12} color={activeBank ? PRIMARY : colors.textSecondary} />
        </Pressable>

        {/* Sort picker */}
        <Pressable
          onPress={() => sortSheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel="Sort offers"
          style={[styles.filterPill, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.filterPillText, { color: colors.text }]} numberOfLines={1}>
            {SORT_OPTIONS.find((o) => o.id === sortMode)?.label}
          </Text>
          <Icon name="chevron-down" size={12} color={colors.textSecondary} />
        </Pressable>

        {/* Only my cards toggle */}
        <Pressable
          onPress={() => setOnlyMyCards((v) => !v)}
          style={[
            styles.filterPill,
            { borderColor: onlyMyCards ? PRIMARY : colors.border, backgroundColor: onlyMyCards ? PRIMARY + '22' : colors.surface },
          ]}>
          <Icon name="card-outline" size={13} color={onlyMyCards ? PRIMARY : colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.filterPillText, { color: onlyMyCards ? PRIMARY : colors.text }]}>Only my cards</Text>
        </Pressable>
      </ScrollView>

      {/* Count row */}
      <View style={[styles.countRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{filteredBrands.length}</Text> places with card offers
        </Text>
        <ViewSwitcher gridView={gridView} onChange={onViewChange} />
      </View>

      {/* Brand list / grid */}
      <FlatList
        key={gridView ? 'grid' : 'list'}
        data={filteredBrands}
        keyExtractor={(b) => b.id}
        numColumns={gridView ? GRID_COLS : 1}
        columnWrapperStyle={gridView ? styles.gridRow : undefined}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) =>
          gridView ? (
            <BrandOfferCardGrid
              brand={item}
              maxDiscount={getMaxDiscount(item)}
              onPress={() => navigation.navigate('BrandDetailScreen', { id: item.id })}
            />
          ) : (
            <View style={styles.cardWrap}>
              <BrandOfferCard
                brand={item}
                maxDiscount={getMaxDiscount(item)}
                offers={combinedOffers}
                onPress={() => navigation.navigate('BrandDetailScreen', { id: item.id })}
              />
            </View>
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="card-outline" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No bank card offers found
            </Text>
          </View>
        }
      />

      <FilterPickerSheet
        ref={citySheetRef}
        title="Cities"
        subtitle="Show offers in your city"
        options={CITY_OPTIONS}
        selected={activeCity}
        onSelect={handleCitySelect}
        snapPoint="65%"
      />
      <FilterPickerSheet
        ref={bankSheetRef}
        title="Banks"
        subtitle="Show offers for a specific bank"
        options={bankOptions}
        selected={activeBank}
        onSelect={setActiveBank}
        snapPoint="70%"
      />
      <FilterPickerSheet
        ref={sortSheetRef}
        title="Sort by"
        subtitle="Order places by"
        options={SORT_OPTIONS}
        selected={sortMode}
        onSelect={setSortMode}
        snapPoint="35%"
      />
    </View>
  );
}

const PRIMARY = '#F20D38';

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingBottom: 12,
  },
  appName: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  screenTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  topActions: { flexDirection: 'row', gap: 8 },
  topBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  chipsScroll: { height: 44, flexGrow: 0, flexShrink: 0 },
  filterScroll: { height: 48, flexGrow: 0, flexShrink: 0 },
  chipsRow: {
    paddingHorizontal: PAD,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    flexShrink: 0,
    height: 32,
  },
  chipLabel: { fontSize: 10, fontWeight: '600' },
  filterBar: {
    paddingHorizontal: PAD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexShrink: 0,
    height: 36,
    maxWidth: 200,
  },
  filterPillText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  countText: { fontSize: 13 },
  list: { paddingHorizontal: PAD, paddingTop: 14 },
  gridRow: { gap: GRID_COL_GAP, marginBottom: GRID_COL_GAP },
  cardWrap: { marginBottom: 14 },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  coverWrap: {
    width: '100%', height: CARD_H,
    position: 'relative', overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  coverScrim: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  discountText: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  banksPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  banksPillText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  cardFooter: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 16, fontWeight: '800', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13 },
  divider: { height: 1, marginVertical: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
