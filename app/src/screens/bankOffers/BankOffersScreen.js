import { useEffect, useMemo, useState } from 'react';
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
import BrandLogo from '../../components/BrandLogo';
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
  { id: 'dining', label: 'Dining', icon: '🍴' },
  { id: 'shopping', label: 'Shopping', icon: '🛍' },
  { id: 'health', label: 'Health', icon: '🏥' },
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
];

const CATEGORY_MATCH = {
  dining: /dining|food|restaurant|cafe|bakery/i,
  shopping: /fashion|apparel|clothing|retail|shopping|accessories/i,
  health: /health|pharma|beauty|cosmetic|wellness/i,
  grocery: /grocery|supermarket|hypermarket/i,
  travel: /travel|hotel|flight/i,
};

function BrandOfferCard({ brand, maxDiscount, offers = BANK_CARD_OFFERS, onPress }) {
  const { colors } = useTheme();

  const badge = maxDiscount ? `Up to ${maxDiscount}% OFF` : 'Up to 20% OFF';

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
        <View style={styles.coverOverlay} />
        <Text style={styles.watermark} numberOfLines={1}>{brand.name.toUpperCase()}</Text>

        {/* Discount badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>

      {/* Card footer */}
      <View style={[styles.cardFooter, { backgroundColor: colors.surface }]}>
        <BrandLogo brand={brand} size={40} tone="filled" fit="cover" elevated />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{brand.name}</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {brand.category}
          </Text>
        </View>
        <View style={styles.offerCount}>
          <Icon name="card-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.offerCountText}>
            {offers.filter((o) => o.brandSlug === brand.id).length || '8+'} banks
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function BankOffersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const brands = useDataStore((s) => s.brands);
  const deals = useDataStore((s) => s.deals);
  const savedCards = useBankCardsStore((s) => s.cards);
  const fetchedBankOffers = useBankOffersStore((s) => s.offers);

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeBank, setActiveBank] = useState(null);

  useEffect(() => {
    loadBankCardOffers();
  }, []);

  // Live, scraped offers (takhfif.app) layered on top of the static seed
  // array — see services/bankOffersApi.js.
  const combinedOffers = useMemo(
    () => [...BANK_CARD_OFFERS, ...fetchedBankOffers],
    [fetchedBankOffers],
  );

  const filteredBrands = useMemo(() => {
    let list = brands;

    // Bank filter: only brands that have offers for the selected bank
    if (activeBank) {
      const allowedSlugs = new Set(getBrandSlugsForBank(activeBank, combinedOffers));
      list = list.filter((b) => allowedSlugs.has(b.id));
    }

    // Category filter
    if (activeCategory !== 'all') {
      const pattern = CATEGORY_MATCH[activeCategory];
      if (pattern) {
        list = list.filter((b) => pattern.test(b.category));
      }
    }

    return list;
  }, [brands, activeBank, activeCategory, combinedOffers]);

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

  const qualifyingCardBanks = useMemo(
    () => new Set(savedCards.map((c) => c.bankId)),
    [savedCards],
  );

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

<View>
      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}>
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          const label = cat.icon ? `${cat.icon}  ${cat.label}` : cat.label;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[
                styles.chip,
                { backgroundColor: active ? PRIMARY : colors.surface, borderColor: active ? PRIMARY : colors.border },
              ]}>
              <Text style={[styles.chipLabel, { color: active ? '#FFFFFF' : colors.text }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>

<View>

      {/* Bank chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}>
        <Pressable
          onPress={() => setActiveBank(null)}
          style={[
            styles.bankChip,
            {
              backgroundColor: !activeBank ? '#1A1A2E' : colors.surface,
              borderColor: !activeBank ? '#1A1A2E' : colors.border,
            },
          ]}>
          <Text style={[styles.bankChipLabel, { color: !activeBank ? '#FFFFFF' : colors.text }]}>
            All Banks
          </Text>
        </Pressable>
        {SUPPORTED_BANKS.map((bank) => {
          const isActive = activeBank === bank.id;
          const userHasCard = qualifyingCardBanks.has(bank.id);
          return (
            <Pressable
              key={bank.id}
              onPress={() => setActiveBank(isActive ? null : bank.id)}
              style={[
                styles.bankChip,
                {
                  backgroundColor: isActive ? bank.color : colors.surface,
                  borderColor: isActive ? bank.color : colors.border,
                },
              ]}>
              <View style={[styles.bankDot, { backgroundColor: isActive ? '#FFFFFF' : bank.color }]} />
              <Text style={[styles.bankChipLabel, { color: isActive ? '#FFFFFF' : colors.text }]}>
                {bank.name}
              </Text>
              {userHasCard && !isActive ? (
                <View style={[styles.myCardDot, { backgroundColor: colors.primary }]} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      </View>

      {/* Count + Sort row */}
      <View style={[styles.countRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{filteredBrands.length}</Text> places
        </Text>
        <Pressable style={styles.sortBtn} hitSlop={8}>
          <Icon name="funnel-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>Sort</Text>
        </Pressable>
      </View>

      {/* Brand list */}
      <FlatList
        data={filteredBrands}
        keyExtractor={(b) => b.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <BrandOfferCard
              brand={item}
              maxDiscount={getMaxDiscount(item)}
              offers={combinedOffers}
              onPress={() => navigation.navigate('BrandDetailScreen', { id: item.id })}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="card-outline" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No bank card offers found
            </Text>
          </View>
        }
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
  chipsRow: {
    paddingHorizontal: PAD,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    flexShrink: 0,
    height: 32,
    marginBottom: 8,
  },
  chipLabel: { fontSize: 10, fontWeight: '600' },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
    flexShrink: 0,
    height: 32,

  },
  bankDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  bankChipLabel: { fontSize: 12, fontWeight: '600' },
  myCardDot: {
    width: 6, height: 6, borderRadius: 3,
    marginLeft: 4,
  },
  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  countText: { fontSize: 13 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortLabel: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: PAD, paddingTop: 14, },
  cardWrap: { marginBottom: 14 },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  coverWrap: {
    width: '100%', height: CARD_H,
    position: 'relative', overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,20,40,0.55)',
  },
  watermark: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    fontSize: 42,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.14)',
    letterSpacing: 2,
  },
  badge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '800' },
  cardMeta: { fontSize: 12, marginTop: 2 },
  offerCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offerCountText: { fontSize: 11, color: '#6B7C93', fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
