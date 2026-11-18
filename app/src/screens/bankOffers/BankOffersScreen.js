import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Skeleton from '../../components/Skeleton';
import AnimatedListItem from '../../components/AnimatedListItem';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../../hooks/useTheme';
import useBankCardsStore from '../../state/bankCardsStore';
import { fetchScrapedBusinesses } from '../../services/bankOffersApi';
import Geolocation from '@react-native-community/geolocation';
import FilterPickerSheet from '../../components/FilterPickerSheet';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';
import { SUPPORTED_BANKS } from '../../config/banks';

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

const isOtherCategory = (cat) =>
  !Object.values(CATEGORY_MATCH).some((p) => p.test(cat || ''));

const SORT_OPTIONS = [
  { id: 'popular', label: 'Popular (most reviews)' },
  { id: 'discount', label: 'Most discount' },
  { id: 'rating', label: 'Highest rated' },
];

// Known city center coordinates for proximity estimation on the listing screen
const CITY_COORDS = {
  karachi:    { lat: 24.8607, lng: 67.0104 },
  lahore:     { lat: 31.5497, lng: 74.3436 },
  islamabad:  { lat: 33.6844, lng: 73.0479 },
  rawalpindi: { lat: 33.6007, lng: 73.0679 },
  faisalabad: { lat: 31.4504, lng: 73.1350 },
  multan:     { lat: 30.1575, lng: 71.5249 },
  hyderabad:  { lat: 25.3960, lng: 68.3578 },
  peshawar:   { lat: 34.0151, lng: 71.5249 },
  quetta:     { lat: 30.1798, lng: 66.9750 },
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r, dLng = (lng2 - lng1) * d2r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cityDistKm(userLat, userLng, cityStr) {
  if (!cityStr) return null;
  const key = Object.keys(CITY_COORDS).find((k) => cityStr.toLowerCase().includes(k));
  if (!key) return null;
  return haversineKm(userLat, userLng, CITY_COORDS[key].lat, CITY_COORDS[key].lng);
}

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

function formatExpiry(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const expired = d < new Date();
  const label = d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  return { label, expired };
}

const BusinessOfferCard = memo(function BusinessOfferCard({ business, onPress }) {
  const { colors } = useTheme();
  const discountText = business.max_discount ? `Up to ${business.max_discount}% off` : 'Bank card offers';

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      accessibilityRole="button"
      accessibilityLabel={`${business.name} bank card offers`}
      accessibilityHint="Double tap to view offers">

      <View style={styles.coverWrap}>
        {business.cover_image_url ? (
          <FastImage
            source={{ uri: business.cover_image_url, priority: FastImage.priority.high, cache: FastImage.cacheControl.web }}
            style={styles.coverImage}
            resizeMode={FastImage.resizeMode.cover}
          />
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
          <View style={styles.logoWrap}>
            {business.logo_url ? (
              <FastImage
                source={{ uri: business.logo_url, priority: FastImage.priority.normal, cache: FastImage.cacheControl.web }}
                style={styles.logoImg}
                resizeMode={FastImage.resizeMode.contain}
              />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                <Text style={[styles.logoInitial, { color: colors.primary }]}>
                  {business.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
          </View>
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

        {/* Row 2: city + category (left) | card count (right) */}
        <View style={styles.metaRow}>
          {business.city ? (
            <>
              <Icon name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{business.city}</Text>
              <Text style={[styles.metaDot, { color: colors.textSecondary }]}>·</Text>
            </>
          ) : null}
          <Text style={[styles.metaText, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
            {business.category || 'General'}
          </Text>
          <View style={styles.cardCountPill}>
            <Icon name="card-outline" size={11} color={colors.textSecondary} />
            <Text style={[styles.cardCountText, { color: colors.textSecondary }]}>
              {business.card_count} offers
            </Text>
          </View>
        </View>

      </View>
    </Pressable>
  );
});

// ── Business card (grid view) ─────────────────────────────────────────────────

const BusinessOfferCardGrid = memo(function BusinessOfferCardGrid({ business, onPress }) {
  const { colors } = useTheme();
  const discountText = business.max_discount ? `Up to ${business.max_discount}% off` : 'Card offers';
  return (
    <Pressable
      style={[stylesGrid.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      accessibilityRole="button"
      accessibilityLabel={`${business.name} bank card offers`}
      accessibilityHint="Double tap to view offers">
      <View style={stylesGrid.cover}>
        {business.cover_image_url ? (
          <FastImage
            source={{ uri: business.cover_image_url, priority: FastImage.priority.high, cache: FastImage.cacheControl.web }}
            style={stylesGrid.coverImg}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[stylesGrid.coverImg, { backgroundColor: colors.border }]} />
        )}
        <View style={stylesGrid.scrim} />
        <Text style={stylesGrid.discountText} numberOfLines={1}>{discountText}</Text>
        {business.rating ? (
          <View style={stylesGrid.ratingBadge}>
            <Icon name="star" size={9} color="#F59E0B" />
            <Text style={stylesGrid.ratingText}>{Number(business.rating).toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <View style={stylesGrid.footer}>
        <View style={stylesGrid.logoWrap}>
          {business.logo_url ? (
            <FastImage
              source={{ uri: business.logo_url, priority: FastImage.priority.normal, cache: FastImage.cacheControl.web }}
              style={stylesGrid.logoImg}
              resizeMode={FastImage.resizeMode.contain}
            />
          ) : (
            <View style={[stylesGrid.logoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[stylesGrid.logoInitial, { color: colors.primary }]}>
                {business.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </View>
        <Text style={[stylesGrid.name, { color: colors.text }]} numberOfLines={1}>{business.name}</Text>
      </View>
      <Text style={[stylesGrid.meta, { color: colors.textSecondary }]} numberOfLines={1}>
        {business.city ? `${business.city} · ` : ''}{business.category || 'General'}
      </Text>
    </Pressable>
  );
});

const GRID_COL_GAP = 10;
const GRID_COLS = 2;
const PAGE_SIZE = 20;

// ── Skeleton card — same pulsing shimmer as HomeScreen ────────────────────────

const CARD_W = SCREEN_W - 2 * PAD;
const GRID_CARD_W = Math.floor((SCREEN_W - 2 * PAD - GRID_COL_GAP) / 2);


function SkeletonCard({ gridView }) {
  const { colors } = useTheme();
  if (gridView) {
    return (
      <View style={[stylesGrid.card, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, overflow: 'hidden' }]}>
        <View style={{ width: '100%', height: 100, overflow: 'hidden' }}>
          <Skeleton width={GRID_CARD_W} height={100} radius={0} />
        </View>
        <View style={{ padding: 10, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Skeleton width={28} height={28} radius={8} />
            <Skeleton width={GRID_CARD_W * 0.45} height={10} />
          </View>
          <Skeleton width={GRID_CARD_W * 0.6} height={8} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: 14, overflow: 'hidden' }]}>
      <Skeleton width={CARD_W} height={CARD_H} radius={0} />
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Skeleton width={36} height={36} radius={10} />
          <Skeleton width={CARD_W * 0.45} height={14} />
          <Skeleton width={48} height={22} radius={8} style={{ marginLeft: 'auto' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Skeleton width={CARD_W * 0.3} height={10} />
          <Skeleton width={CARD_W * 0.25} height={10} />
          <Skeleton width={60} height={10} style={{ marginLeft: 'auto' }} />
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BankOffersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const savedCards = useBankCardsStore((s) => s.cards);
  const [gridView, onViewChange] = useViewMode(false);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeBank, setActiveBank] = useState(route.params?.bankFilter ?? null);
  const [sortMode, setSortMode] = useState('popular');
  const [onlyMyCards, setOnlyMyCards] = useState(false);
  const [activeCity, setActiveCity] = useState(null);
  const [userGPS, setUserGPS] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const searchInputRef = useRef(null);

  const citySheetRef = useRef(null);
  const bankSheetRef = useRef(null);
  const sortSheetRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchScrapedBusinesses()
      .then(setBusinesses)
      .catch((e) => setLoadError(e?.message ?? 'Failed to load offers'))
      .finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLoadError(null);
    fetchScrapedBusinesses()
      .then(setBusinesses)
      .catch((e) => setLoadError(e?.message ?? 'Failed to load offers'))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCitySelect = useCallback((id) => {
    setActiveCity(id);
    if (id === 'nearby') {
      setNearbyLoading(true);
      Geolocation.getCurrentPosition(
        ({ coords }) => {
          setUserGPS({ lat: coords.latitude, lng: coords.longitude });
          setNearbyLoading(false);
        },
        () => setNearbyLoading(false),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    } else {
      setUserGPS(null);
    }
  }, []);

  const savedBankIds = useMemo(
    () => new Set(savedCards.map((c) => c.bankId)),
    [savedCards],
  );

  // Derive unique bank names from loaded data (dynamic — no static config needed)
  const bankOptions = useMemo(() => {
    const seen = new Set();
    for (const b of businesses) {
      for (const name of b.bank_names ?? []) {
        if (name) seen.add(name);
      }
    }
    return [
      { id: null, label: 'All banks' },
      ...Array.from(seen).sort().map((name) => ({ id: name, label: name })),
    ];
  }, [businesses]);

  // Derive dynamic category list; keep static preset order, append unknowns
  const categoryOptions = useMemo(() => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    const extra = [];
    for (const b of businesses) {
      if (!b.category) continue;
      const lc = b.category.toLowerCase();
      const matched = Object.entries(CATEGORY_MATCH).some(([, p]) => p.test(lc));
      if (!matched && !known.has(lc)) {
        known.add(lc);
        extra.push({ id: lc, label: b.category, icon: 'pricetag-outline' });
      }
    }
    // Replace the generic 'other' at the end with any extra dynamic ones, then other
    const withoutOther = CATEGORIES.filter((c) => c.id !== 'other');
    return [...withoutOther, ...extra, CATEGORIES.find((c) => c.id === 'other')];
  }, [businesses]);

  const filteredBusinesses = useMemo(() => {
    let list = businesses;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((b) =>
        b.name?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q),
      );
    }

    // Bank filter — direct name match against bank_names array
    if (activeBank) {
      const lc = activeBank.toLowerCase();
      list = list.filter((b) =>
        (b.bank_names ?? []).some((n) => n.toLowerCase() === lc),
      );
    }

    // Only my cards — match via SUPPORTED_BANKS takhfifName for saved cards
    if (onlyMyCards && savedCards.length > 0) {
      const myBankTakhfifNames = SUPPORTED_BANKS
        .filter((b) => savedBankIds.has(b.id))
        .map((b) => (b.takhfifName ?? b.name).toLowerCase());
      list = list.filter((b) =>
        (b.bank_names ?? []).some((n) => myBankTakhfifNames.some((t) => n.toLowerCase().includes(t))),
      );
    }

    // City filter — 'nearby' sorts by proximity instead of filtering to one city
    if (activeCity && activeCity !== 'nearby') {
      list = list.filter((b) => b.city?.toLowerCase().includes(activeCity));
    }

    // Category filter — preset regex match, 'other' fallback, or exact dynamic id
    if (activeCategory === 'other') {
      list = list.filter((b) => isOtherCategory(b.category));
    } else if (activeCategory !== 'all') {
      const pattern = CATEGORY_MATCH[activeCategory];
      if (pattern) {
        list = list.filter((b) => pattern.test(b.category || ''));
      } else {
        list = list.filter((b) => (b.category ?? '').toLowerCase() === activeCategory);
      }
    }

    // Sort — nearby uses GPS distance, otherwise user-selected sort
    if (activeCity === 'nearby' && userGPS) {
      list = [...list]
        .map((b) => ({ ...b, _dist: cityDistKm(userGPS.lat, userGPS.lng, b.city) }))
        .sort((a, b) => {
          if (a._dist == null) return 1;
          if (b._dist == null) return -1;
          return a._dist - b._dist;
        });
    } else if (sortMode === 'discount') {
      list = [...list].sort((a, b) => (b.max_discount ?? 0) - (a.max_discount ?? 0));
    } else if (sortMode === 'rating') {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    return list;
  }, [businesses, searchQuery, activeBank, activeCategory, activeCity, userGPS, onlyMyCards, savedBankIds, savedCards.length, sortMode]);

  // Reset visible slice whenever the filtered result set changes (reference changes on any filter update)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filteredBusinesses]);

  const pagedBusinesses = useMemo(
    () => filteredBusinesses.slice(0, visibleCount),
    [filteredBusinesses, visibleCount],
  );

  const loadMoreItems = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredBusinesses.length));
  }, [filteredBusinesses.length]);

  const handlePress = useCallback((business) => {
    navigation.navigate('BankOfferDetailScreen', { business });
  }, [navigation]);

  // Memoised renderItem — staggered FadeInDown entrance matching the Explore screen
  const renderItem = useCallback(({ item, index }) =>
    gridView ? (
      <AnimatedListItem index={index} style={{ flex: 1 }}>
        <BusinessOfferCardGrid business={item} onPress={() => handlePress(item)} />
      </AnimatedListItem>
    ) : (
      <AnimatedListItem index={index} style={styles.cardWrap}>
        <BusinessOfferCard business={item} onPress={() => handlePress(item)} />
      </AnimatedListItem>
    ),
    [gridView, handlePress],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {searchActive ? (
          /* Search mode */
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="search-outline" size={16} color={colors.textSecondary} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search places, categories…"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable hitSlop={8} onPress={() => setSearchQuery('')}>
                  <Icon name="close-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => { setSearchActive(false); setSearchQuery(''); }}
              style={styles.cancelBtn}>
              <Text style={[styles.cancelTxt, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          /* Normal mode */
          <>
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
                onPress={() => setSearchActive(true)}
                style={[styles.topBtn, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Search bank offers">
                <Icon name="search-outline" size={20} color={colors.text} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        style={styles.chipsScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}>
        {categoryOptions.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[
                styles.chip,
                { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
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
          style={[styles.filterPill, { borderColor: activeCity ? colors.primary : colors.border, backgroundColor: colors.surface }]}>
          {activeCity === 'nearby' ? (
            <Icon name={nearbyLoading ? 'sync-outline' : 'navigate'} size={12} color={colors.primary} style={{ marginRight: 4 }} />
          ) : null}
          <Text style={[styles.filterPillText, { color: activeCity ? colors.primary : colors.text }]} numberOfLines={1}>
            {activeCity === 'nearby'
              ? (nearbyLoading ? 'Locating…' : 'Near me')
              : activeCity ? CITY_OPTIONS.find((c) => c.id === activeCity)?.label : 'All cities'}
          </Text>
          <Icon name="chevron-down" size={12} color={activeCity ? colors.primary : colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={() => bankSheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel="Filter by bank"
          style={[styles.filterPill, { borderColor: activeBank ? colors.primary : colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.filterPillText, { color: activeBank ? colors.primary : colors.text }]} numberOfLines={1}>
            {activeBank ?? 'All banks'}
          </Text>
          <Icon name="chevron-down" size={12} color={activeBank ? colors.primary : colors.textSecondary} />
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
          onPress={() => {
            if (!onlyMyCards && savedCards.length === 0) {
              Alert.alert(
                'No cards added',
                'Add a bank card first to filter offers by your cards.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Add card', onPress: () => navigation.navigate('MyCardsScreen') },
                ],
              );
              return;
            }
            setOnlyMyCards((v) => !v);
          }}
          style={[
            styles.filterPill,
            { borderColor: onlyMyCards ? colors.primary : colors.border, backgroundColor: onlyMyCards ? colors.primary + '22' : colors.surface },
          ]}>
          <Icon name="card-outline" size={13} color={onlyMyCards ? colors.primary : colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.filterPillText, { color: onlyMyCards ? colors.primary : colors.text }]}>Only my cards</Text>
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

      {/* Business list / grid — skeletons on first load, dimmed on refresh */}
      {loading ? (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}>
          {gridView ? (
            <>
              <View style={[styles.gridRow, { marginBottom: GRID_COL_GAP }]}>
                <SkeletonCard gridView />
                <SkeletonCard gridView />
              </View>
              <View style={[styles.gridRow, { marginBottom: GRID_COL_GAP }]}>
                <SkeletonCard gridView />
                <SkeletonCard gridView />
              </View>
              <View style={[styles.gridRow, { marginBottom: GRID_COL_GAP }]}>
                <SkeletonCard gridView />
                <SkeletonCard gridView />
              </View>
            </>
          ) : (
            [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, opacity: refreshing ? 0.6 : 1 }}>
          <FlatList
            key={gridView ? 'grid' : 'list'}
            data={pagedBusinesses}
            keyExtractor={(b) => String(b.id)}
            numColumns={gridView ? GRID_COLS : 1}
            columnWrapperStyle={gridView ? styles.gridRow : undefined}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMoreItems}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            renderItem={renderItem}
            ListFooterComponent={
              visibleCount < filteredBusinesses.length ? (
                <View style={styles.paginationFooter}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Icon name={loadError ? 'alert-circle-outline' : 'card-outline'} size={40} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {loadError ? 'Could not load offers' : 'No bank card offers found'}
                </Text>
                {loadError ? (
                  <Pressable
                    onPress={load}
                    style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading offers">
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            }
          />
        </View>
      )}

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
  searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 44, borderRadius: 22, borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  cancelBtn: { paddingVertical: 8 },
  cancelTxt: { fontSize: 15, fontWeight: '600' },
  topBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  chipsScroll: { height: 52, flexGrow: 0, flexShrink: 0 },
  filterScroll: { height: 48, flexGrow: 0, flexShrink: 0 },
  chipsRow: { paddingHorizontal: PAD, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, borderRadius: 20, borderWidth: 1,
    marginRight: 8, flexShrink: 0, height: 40,
  },
  chipLabel: { fontSize: 12, fontWeight: '600' },
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
  gridRow: { flexDirection: 'row', gap: GRID_COL_GAP, marginBottom: GRID_COL_GAP },
  cardWrap: { marginBottom: 14 },
  card: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  coverWrap: { width: '100%', height: CARD_H, position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.30)' },
  discountText: { position: 'absolute', bottom: 14, left: 14, fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  banksPill: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  banksPillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  cardFooter: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, gap: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 0.8, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    overflow: 'hidden',
  },
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
  cardCountPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardCountText: { fontSize: 12, fontWeight: '600' },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  expiryText: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  paginationFooter: { alignItems: 'center', paddingVertical: 20 },
});

const stylesGrid = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', height: 100, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  discountText: { position: 'absolute', bottom: 6, left: 8, fontSize: 11, fontWeight: '800', color: '#FFF' },
  ratingBadge: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 3,
  },
  ratingText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8 },
  logoWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 0.8, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    overflow: 'hidden',
  },
  logoImg: { width: 28, height: 28 },
  logoPlaceholder: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 13, fontWeight: '800' },
  name: { fontSize: 12, fontWeight: '800', flex: 1 },
  meta: { fontSize: 11, paddingHorizontal: 10, marginTop: 2, paddingTop: 5, paddingBottom: 10 },
  expiry: { fontSize: 10, paddingHorizontal: 10, paddingBottom: 8, marginTop: 1 },
});
