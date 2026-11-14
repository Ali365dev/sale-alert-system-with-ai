import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
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
import useBankCardsStore from '../../state/bankCardsStore';
import { fetchScrapedBusinesses } from '../../services/bankOffersApi';
import Geolocation from '@react-native-community/geolocation';
import FilterPickerSheet from '../../components/FilterPickerSheet';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';
import { requestLocationPermission } from '../../services/regionDetection';
import { SUPPORTED_BANKS } from '../../config/banks';

const { width: SCREEN_W } = Dimensions.get('window');
const PAD = 16;
const CARD_H = 170;
const PRIMARY = '#F20D38';

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

const isOtherCategory = (cat) =>
  !Object.values(CATEGORY_MATCH).some((p) => p.test(cat || ''));

const SORT_OPTIONS = [
  { id: 'popular', label: 'Popular (most reviews)' },
  { id: 'discount', label: 'Most discount' },
  { id: 'rating', label: 'Highest rated' },
];

const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const CITY_OPTIONS = [
  { id: null,         label: 'All cities' },
  { id: 'nearby',     label: 'Near me',    icon: 'navigate-outline' },
  { id: 'karachi',    label: 'Karachi' },
  { id: 'lahore',     label: 'Lahore' },
  { id: 'islamabad',  label: 'Islamabad' },
  { id: 'faisalabad', label: 'Faisalabad' },
  { id: 'multan',     label: 'Multan' },
  { id: 'rawalpindi', label: 'Rawalpindi' },
  { id: 'hyderabad',  label: 'Hyderabad' },
  { id: 'peshawar',   label: 'Peshawar' },
  { id: 'quetta',     label: 'Quetta' },
];

// ── Business card (list view) ─────────────────────────────────────────────────

function BusinessOfferCard({ business, onPress }) {
  const { colors } = useTheme();
  const discountText = business.max_discount ? `Up to ${business.max_discount}% off` : 'Bank card offers';

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${business.name} bank card offers`}>

      <View style={styles.coverWrap}>
        {business.cover_image_url ? (
          <Image source={{ uri: business.cover_image_url }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.coverImage, { backgroundColor: colors.border }]} />
        )}
        <View style={styles.coverScrim} />
        <Text style={styles.discountText}>{discountText}</Text>
        <View style={styles.banksPill}>
          <Text style={styles.banksPillText}>{business.bank_count} banks</Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { backgroundColor: colors.surface }]}>
        {/* Row 1: logo + name + rating */}
        <View style={styles.footerRow}>
          {business.logo_url ? (
            <Image source={{ uri: business.logo_url }} style={styles.logoImg} resizeMode="contain" />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: PRIMARY + '22' }]}>
              <Text style={[styles.logoInitial, { color: PRIMARY }]}>
                {business.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
            {business.name}
          </Text>
          {business.rating != null && (
            <View style={styles.ratingBadge}>
              <Icon name="star" size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{business.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Row 2: city + category */}
        <View style={styles.metaRow}>
          {business.city ? (
            <>
              <Icon name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{business.city}</Text>
              <Text style={[styles.metaDot, { color: colors.textSecondary }]}>·</Text>
            </>
          ) : null}
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {business.category || 'General'}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Row 3: card count */}
        <View style={styles.metaRow}>
          <Icon name="card-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {business.card_count} card offers
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Business card (grid view) ─────────────────────────────────────────────────

function BusinessOfferCardGrid({ business, onPress }) {
  const { colors } = useTheme();
  const discountText = business.max_discount ? `Up to ${business.max_discount}% off` : 'Card offers';
  return (
    <Pressable
      style={[stylesGrid.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${business.name} bank card offers`}>
      <View style={stylesGrid.cover}>
        {business.cover_image_url ? (
          <Image source={{ uri: business.cover_image_url }} style={stylesGrid.coverImg} resizeMode="cover" />
        ) : (
          <View style={[stylesGrid.coverImg, { backgroundColor: colors.border }]} />
        )}
        <View style={stylesGrid.scrim} />
        <Text style={stylesGrid.discountText} numberOfLines={1}>{discountText}</Text>
      </View>
      <View style={stylesGrid.footer}>
        {business.logo_url ? (
          <Image source={{ uri: business.logo_url }} style={stylesGrid.logoImg} resizeMode="contain" />
        ) : (
          <View style={[stylesGrid.logoPlaceholder, { backgroundColor: PRIMARY + '22' }]}>
            <Text style={[stylesGrid.logoInitial, { color: PRIMARY }]}>
              {business.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <Text style={[stylesGrid.name, { color: colors.text }]} numberOfLines={1}>{business.name}</Text>
      </View>
      <Text style={[stylesGrid.meta, { color: colors.textSecondary }]} numberOfLines={1}>
        {business.city ? `${business.city} · ` : ''}{business.category || 'General'}
      </Text>
    </Pressable>
  );
}

const GRID_COL_GAP = 10;
const GRID_COLS = 2;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BankOffersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const savedCards = useBankCardsStore((s) => s.cards);
  const [gridView, onViewChange] = useViewMode(false);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeBank, setActiveBank] = useState(null);
  const [sortMode, setSortMode] = useState('popular');
  const [onlyMyCards, setOnlyMyCards] = useState(false);
  const [activeCity, setActiveCity] = useState(null);
  const [nearbyCity, setNearbyCity] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const citySheetRef = useRef(null);
  const bankSheetRef = useRef(null);
  const sortSheetRef = useRef(null);

  useEffect(() => {
    fetchScrapedBusinesses()
      .then(setBusinesses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    if (id === 'nearby') resolveNearbyCity();
    else setNearbyCity(null);
  }, [resolveNearbyCity]);

  const savedBankIds = useMemo(
    () => new Set(savedCards.map((c) => c.bankId)),
    [savedCards],
  );

  const bankOptions = useMemo(
    () => [
      { id: null, label: 'All banks' },
      ...SUPPORTED_BANKS.map((b) => ({ id: b.id, label: b.name })),
    ],
    [],
  );

  const filteredBusinesses = useMemo(() => {
    let list = businesses;

    // Bank filter — business.bank_names contains takhfif bank names
    if (activeBank) {
      const bankName = SUPPORTED_BANKS.find((b) => b.id === activeBank)?.takhfifName ?? '';
      list = list.filter((b) =>
        b.bank_names.some((n) => n.toLowerCase().includes(bankName.toLowerCase())),
      );
    }

    // Only my cards
    if (onlyMyCards && savedCards.length > 0) {
      const myBankTakhfifNames = SUPPORTED_BANKS
        .filter((b) => savedBankIds.has(b.id))
        .map((b) => b.takhfifName.toLowerCase());
      list = list.filter((b) =>
        b.bank_names.some((n) => myBankTakhfifNames.some((t) => n.toLowerCase().includes(t))),
      );
    }

    // City filter
    const effectiveCity = activeCity === 'nearby' ? nearbyCity : activeCity;
    if (effectiveCity) {
      list = list.filter((b) => b.city?.toLowerCase().includes(effectiveCity));
    }

    // Category filter
    if (activeCategory === 'other') {
      list = list.filter((b) => isOtherCategory(b.category));
    } else if (activeCategory !== 'all') {
      const pattern = CATEGORY_MATCH[activeCategory];
      if (pattern) list = list.filter((b) => pattern.test(b.category || ''));
    }

    // Sort
    if (sortMode === 'discount') {
      list = [...list].sort((a, b) => (b.max_discount ?? 0) - (a.max_discount ?? 0));
    } else if (sortMode === 'rating') {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    // 'popular' = default API order (review_count desc from backend)

    return list;
  }, [businesses, activeBank, activeCategory, activeCity, nearbyCity, onlyMyCards, savedBankIds, savedCards.length, sortMode]);

  const handlePress = useCallback((business) => {
    if (business.brand_id) {
      navigation.navigate('BrandDetailScreen', { id: business.brand_id });
    } else if (business.source_url) {
      Linking.openURL(business.source_url).catch(() => {});
    }
  }, [navigation]);

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
                <Icon name={cat.icon} size={12} color={active ? '#FFF' : colors.text} style={{ marginRight: 4 }} />
              ) : null}
              <Text style={[styles.chipLabel, { color: active ? '#FFF' : colors.text }]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Filter bar */}
      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}>

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
          {loading ? (
            'Loading…'
          ) : (
            <>
              <Text style={{ fontWeight: '700', color: colors.text }}>{filteredBusinesses.length}</Text>
              {' places with card offers'}
            </>
          )}
        </Text>
        <ViewSwitcher gridView={gridView} onChange={onViewChange} />
      </View>

      {/* Business list / grid */}
      <FlatList
        key={gridView ? 'grid' : 'list'}
        data={filteredBusinesses}
        keyExtractor={(b) => String(b.id)}
        numColumns={gridView ? GRID_COLS : 1}
        columnWrapperStyle={gridView ? styles.gridRow : undefined}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) =>
          gridView ? (
            <BusinessOfferCardGrid business={item} onPress={() => handlePress(item)} />
          ) : (
            <View style={styles.cardWrap}>
              <BusinessOfferCard business={item} onPress={() => handlePress(item)} />
            </View>
          )
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Icon name="card-outline" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No bank card offers found
              </Text>
            </View>
          ) : null
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
        snapPoint="40%"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingBottom: 12,
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
  chipsRow: { paddingHorizontal: PAD, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, borderRadius: 20, borderWidth: 1,
    marginRight: 8, flexShrink: 0, height: 32,
  },
  chipLabel: { fontSize: 10, fontWeight: '600' },
  filterBar: { paddingHorizontal: PAD, flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, borderRadius: 18, borderWidth: 1,
    flexShrink: 0, height: 36, maxWidth: 200,
  },
  filterPillText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingVertical: 10, borderBottomWidth: 1,
  },
  countText: { fontSize: 13 },
  list: { paddingHorizontal: PAD, paddingTop: 14 },
  gridRow: { gap: GRID_COL_GAP, marginBottom: GRID_COL_GAP },
  cardWrap: { marginBottom: 14 },
  card: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  coverWrap: { width: '100%', height: CARD_H, position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, backgroundColor: 'rgba(0,0,0,0.48)' },
  discountText: { position: 'absolute', bottom: 14, left: 14, fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  banksPill: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  banksPillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  cardFooter: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: { width: 36, height: 36, borderRadius: 10 },
  logoPlaceholder: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 16, fontWeight: '800' },
  cardName: { fontSize: 16, fontWeight: '800', flex: 1 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13 },
  metaDot: { fontSize: 13 },
  divider: { height: 1, marginVertical: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});

const stylesGrid = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', height: 100, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, backgroundColor: 'rgba(0,0,0,0.5)' },
  discountText: { position: 'absolute', bottom: 6, left: 8, fontSize: 11, fontWeight: '800', color: '#FFF' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8 },
  logoImg: { width: 28, height: 28, borderRadius: 8 },
  logoPlaceholder: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 13, fontWeight: '800' },
  name: { fontSize: 12, fontWeight: '800', flex: 1 },
  meta: { fontSize: 11, paddingHorizontal: 10, paddingBottom: 8, marginTop: 2 },
});
