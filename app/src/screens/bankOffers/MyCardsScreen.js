import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../../hooks/useTheme';
import useBankCardsStore from '../../state/bankCardsStore';
import { SUPPORTED_BANKS, getBankById } from '../../config/banks';
import { BANK_CARDS } from '../../config/bankCards';
import CARD_IMAGES from '../../config/cardImages';
import { fetchBankOfferCounts } from '../../services/bankOffersApi';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 48;
const CARD_H = CARD_W / 1.586;
const SHEET_H = SCREEN_H * 0.80;
const GRID_COL_W = (SCREEN_W - 48 - 10) / 2;
const GRID_COL_H = GRID_COL_W / 1.586;

const CARD_GRADIENTS = {
  hbl:        ['#1A6830', '#0D4020'],
  mcb:        ['#8B0000', '#5C0000'],
  meezan:     ['#1B2F5E', '#0D1A38'],
  ubl:        ['#1A237E', '#0D1250'],
  alfalah:    ['#7B241C', '#4A1510'],
  scb:        ['#0D47A1', '#062470'],
  habibmetro: ['#2E7D32', '#1B4D1E'],
  askari:     ['#283593', '#151C5C'],
};

// ─── Saved card ───────────────────────────────────────────────────────────────

function PhysicalCard({ card, onRemove }) {
  const bank = getBankById(card.bankId);
  const gradient = CARD_GRADIENTS[card.bankId] || ['#10233F', '#0A1628'];
  const image = card.imageIdx ? CARD_IMAGES[card.imageIdx] : null;

  if (image) {
    return (
      <View style={[cardStyles.wrap, { width: CARD_W, height: CARD_H }]}>
        <Image source={image} style={cardStyles.image} resizeMode="cover" />
        <Pressable
          onPress={onRemove}
          hitSlop={12}
          style={cardStyles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel="Remove card">
          <Icon name="close" size={12} color="#fff" />
        </Pressable>
        {card.lastFour !== '0000' && (
          <View style={cardStyles.overlay}>
            <Text style={cardStyles.overlayName} numberOfLines={1}>
              {card.cardName ?? bank?.name}
            </Text>
            <Text style={cardStyles.overlayLast}>····{card.lastFour}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[cardStyles.gradient, { width: CARD_W, height: CARD_H, backgroundColor: gradient[0] }]}>
      <View style={[cardStyles.gradientShine, { backgroundColor: gradient[1] }]} />
      <View style={cardStyles.gradientTop}>
        <View style={cardStyles.chip} />
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={cardStyles.gradientRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove card">
          <Icon name="close" size={14} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>
      <Text style={cardStyles.number}>•••• •••• •••• {card.lastFour}</Text>
      <View style={cardStyles.gradientBottom}>
        <Text style={cardStyles.cardType}>{card.cardType.toUpperCase()}</Text>
        <Text style={cardStyles.bankName}>{bank?.name ?? card.bankId.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#111' },
  image: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  overlayName: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  overlayLast: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', letterSpacing: 2 },
  gradient: { borderRadius: 18, padding: 20, overflow: 'hidden' },
  gradientShine: {
    position: 'absolute', top: -20, right: -20,
    width: 160, height: 160, borderRadius: 80, opacity: 0.35,
  },
  gradientTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chip: { width: 32, height: 24, borderRadius: 4, backgroundColor: '#F5C518' },
  gradientRemove: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  number: {
    color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600',
    letterSpacing: 2, marginTop: 20, marginBottom: 12,
  },
  gradientBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardType: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  bankName: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});

// ─── Bank step ────────────────────────────────────────────────────────────────

function BankStep({ onSelect, colors }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return SUPPORTED_BANKS;
    return SUPPORTED_BANKS.filter(
      (b) => b.name.toLowerCase().includes(q) || b.fullName.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={[bankStepStyles.searchWrap, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <Icon name="search-outline" size={16} color={colors.textSecondary} />
        <TextInput
          style={[bankStepStyles.searchInput, { color: colors.text }]}
          placeholder="Search bank…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Icon name="close-circle" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[bankStepStyles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {filtered.map((bank, i) => {
            const isLast = i === filtered.length - 1;
            const cardCount = BANK_CARDS[bank.id]?.length ?? 0;
            return (
              <Pressable
                key={bank.id}
                onPress={() => onSelect(bank)}
                style={[
                  bankStepStyles.row,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}>
                <View style={[bankStepStyles.avatar, { backgroundColor: bank.color }]}>
                  <Text style={bankStepStyles.avatarTxt}>{bank.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[bankStepStyles.name, { color: colors.text }]}>{bank.name}</Text>
                  {cardCount > 0 && (
                    <Text style={[bankStepStyles.sub, { color: colors.textSecondary }]}>
                      {cardCount} cards
                    </Text>
                  )}
                </View>
                <Icon name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <View style={bankStepStyles.emptySearch}>
              <Text style={[bankStepStyles.emptySearchTxt, { color: colors.textSecondary }]}>
                No bank found
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const bankStepStyles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 0 },
  listCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  emptySearch: { paddingVertical: 32, alignItems: 'center' },
  emptySearchTxt: { fontSize: 14 },
});

// ─── Card grid step ───────────────────────────────────────────────────────────

function CardStep({ bank, onSelect, colors }) {
  const cards = BANK_CARDS[bank.id] ?? [];

  if (cards.length === 0) {
    return (
      <View style={gridStyles.empty}>
        <Icon name="card-outline" size={36} color={colors.textSecondary} />
        <Text style={[gridStyles.emptyTxt, { color: colors.textSecondary }]}>
          No cards listed for {bank.name}
        </Text>
      </View>
    );
  }

  const rows = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2));

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={gridStyles.row}>
          {row.map((card, ci) => {
            const img = CARD_IMAGES[card.imageIdx];
            const badge = card.type === 'credit' ? 'Credit' : card.type === 'prepaid' ? 'Prepaid' : 'Debit';
            const badgeColor = card.type === 'credit'
              ? 'rgba(239,68,68,0.9)' : card.type === 'prepaid'
              ? 'rgba(245,158,11,0.9)' : 'rgba(16,185,129,0.9)';
            return (
              <Pressable
                key={ci}
                onPress={() => onSelect(card)}
                style={[gridStyles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${card.name}`}>
                <View style={[gridStyles.imgWrap, { width: GRID_COL_W, height: GRID_COL_H }]}>
                  {img ? (
                    <Image source={img} style={gridStyles.img} resizeMode="cover" />
                  ) : (
                    <View style={[gridStyles.imgPlaceholder, { backgroundColor: colors.backgroundElement }]}>
                      <Icon name="card" size={28} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={[gridStyles.badge, { backgroundColor: badgeColor }]}>
                    <Text style={gridStyles.badgeTxt}>{badge}</Text>
                  </View>
                </View>
                <Text style={[gridStyles.name, { color: colors.text }]} numberOfLines={2}>
                  {card.name}
                </Text>
                <Text style={[gridStyles.network, { color: colors.textSecondary }]}>
                  {card.network.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
          {row.length === 1 && <View style={{ width: GRID_COL_W }} />}
        </View>
      ))}
    </ScrollView>
  );
}

const gridStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  item: { width: GRID_COL_W, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  imgWrap: { backgroundColor: '#1a1a2e' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 6, right: 6,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  name: { fontSize: 11, fontWeight: '700', padding: 8, paddingBottom: 2, lineHeight: 15 },
  network: { fontSize: 10, paddingHorizontal: 8, paddingBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  emptyTxt: { fontSize: 14 },
});

// ─── Last four step ───────────────────────────────────────────────────────────

function LastFourStep({ bank, card, onConfirm, colors }) {
  const [lastFour, setLastFour] = useState('');
  const img = CARD_IMAGES[card.imageIdx];
  const previewW = SCREEN_W * 0.52;
  const previewH = previewW / 1.586;

  return (
    <View style={{ flex: 1 }}>
      {/* Card preview + meta side by side */}
      <View style={lastFourStyles.row}>
        {img && (
          <Image
            source={img}
            style={{ width: previewW, height: previewH, borderRadius: 12 }}
            resizeMode="cover"
          />
        )}
        <View style={lastFourStyles.meta}>
          <Text style={[lastFourStyles.cardName, { color: colors.text }]} numberOfLines={3}>
            {card.name}
          </Text>
          <View style={[lastFourStyles.bankChip, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[lastFourStyles.bankChipTxt, { color: colors.textSecondary }]}>
              {bank.name}
            </Text>
          </View>
        </View>
      </View>

      <View style={[lastFourStyles.divider, { backgroundColor: colors.border }]} />

      {/* Input */}
      <Text style={[lastFourStyles.label, { color: colors.text }]}>
        Last 4 Digits{' '}
        <Text style={[lastFourStyles.optional, { color: colors.textSecondary }]}>
          (optional)
        </Text>
      </Text>
      <TextInput
        style={[lastFourStyles.input, {
          borderColor: lastFour.length > 0 ? colors.primary : colors.border,
          backgroundColor: colors.backgroundElement,
          color: colors.text,
          letterSpacing: lastFour.length > 0 ? 6 : 0,
        }]}
        placeholder="e.g. 4821"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        maxLength={4}
        value={lastFour}
        onChangeText={(t) => setLastFour(t.replace(/\D/g, ''))}
      />
      <Text style={[lastFourStyles.hint, { color: colors.textSecondary }]}>
        Helps identify this card later. Skip to leave blank.
      </Text>

      <Pressable
        onPress={() => onConfirm(lastFour || '0000')}
        style={lastFourStyles.btn}
        accessibilityRole="button">
        <Text style={lastFourStyles.btnLabel}>Add Card</Text>
      </Pressable>
    </View>
  );
}

const lastFourStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  meta: { flex: 1, gap: 10 },
  cardName: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  bankChip: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  bankChipTxt: { fontSize: 12, fontWeight: '600' },
  divider: { height: 1, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  optional: { fontWeight: '400' },
  input: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontWeight: '700',
    minHeight: 48,
  },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  btn: {
    backgroundColor: '#F20D38', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 20,
  },
  btnLabel: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

// ─── Add card bottom sheet ────────────────────────────────────────────────────

function AddCardSheet({ onClose, onAdd }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('bank');
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  const title = step === 'bank' ? 'Select Bank'
    : step === 'card' ? (selectedBank?.name ?? 'Select Card')
    : 'Add Card';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={[
        sheetStyles.sheet,
        { height: SHEET_H, backgroundColor: colors.surface, paddingBottom: insets.bottom + 8 },
      ]}>
        <View style={sheetStyles.handle} />

        {/* Header */}
        <View style={sheetStyles.header}>
          {step !== 'bank' ? (
            <Pressable
              onPress={() => step === 'card' ? setStep('bank') : setStep('card')}
              hitSlop={8}
              style={sheetStyles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Icon name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={sheetStyles.headerBtn} />
          )}
          <Text style={[sheetStyles.title, { color: colors.text }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={sheetStyles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <View style={[sheetStyles.closeCircle, { backgroundColor: colors.backgroundElement }]}>
              <Icon name="close" size={16} color={colors.textSecondary} />
            </View>
          </Pressable>
        </View>

        {/* Body — flex: 1 works because sheet now has explicit height */}
        <View style={sheetStyles.body}>
          {step === 'bank' && (
            <BankStep
              colors={colors}
              onSelect={(bank) => { setSelectedBank(bank); setStep('card'); }}
            />
          )}
          {step === 'card' && selectedBank && (
            <CardStep
              bank={selectedBank}
              colors={colors}
              onSelect={(card) => { setSelectedCard(card); setStep('lastfour'); }}
            />
          )}
          {step === 'lastfour' && selectedBank && selectedCard && (
            <LastFourStep
              bank={selectedBank}
              card={selectedCard}
              colors={colors}
              onConfirm={(lastFour) => {
                onAdd(selectedBank.id, selectedCard.type, lastFour, {
                  cardName: selectedCard.name,
                  imageIdx: selectedCard.imageIdx,
                  network: selectedCard.network,
                });
                onClose();
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, marginBottom: 4,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  closeCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MyCardsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const cards = useBankCardsStore((s) => s.cards);
  const addCard = useBankCardsStore((s) => s.addCard);
  const removeCard = useBankCardsStore((s) => s.removeCard);

  const [showSheet, setShowSheet] = useState(false);
  const [offerCounts, setOfferCounts] = useState({});
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    fetchBankOfferCounts()
      .then(setOfferCounts)
      .catch(() => {});
  }, []);

  const handleRemove = (card) => {
    const bank = getBankById(card.bankId);
    Alert.alert(
      'Remove Card',
      `Remove ${bank?.name ?? card.bankId}${card.lastFour !== '0000' ? ` ····${card.lastFour}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeCard(card.id) },
      ],
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[s.backBtn, { backgroundColor: colors.surface }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Icon name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: colors.text }]}>My Cards</Text>
          <Text style={[s.headerSub, { color: colors.textSecondary }]}>
            Personalize your bank offer feed
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* ── Active Cards ── */}
        <View style={s.sectionRow}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Your Active Cards</Text>
          {cards.length > 0 && (
            <View style={[s.countPill, { backgroundColor: colors.primarySoft }]}>
              <Text style={[s.countPillTxt, { color: colors.primary }]}>{cards.length}</Text>
            </View>
          )}
        </View>

        {cards.length === 0 ? (
          <View style={[s.emptyCards, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.emptyIcon, { backgroundColor: colors.backgroundElement }]}>
              <Icon name="card-outline" size={28} color={colors.textSecondary} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text }]}>No cards added yet</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>
              Add your bank cards to see matching offers
            </Text>
          </View>
        ) : (
          <>
            {/* Horizontal card carousel */}
            <FlatList
              data={cards}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + 12}
              decelerationRate="fast"
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 12));
                setActiveDot(Math.max(0, Math.min(idx, cards.length - 1)));
              }}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingRight: 24 }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <PhysicalCard
                  card={item}
                  onRemove={() => handleRemove(item)}
                />
              )}
            />
            {/* Dot indicators */}
            {cards.length > 1 && (
              <View style={s.dots}>
                {cards.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      { backgroundColor: i === activeDot ? colors.primary : colors.border },
                      i === activeDot && s.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Add Card CTA ── */}
        <Pressable
          onPress={() => setShowSheet(true)}
          style={[s.addCta, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[s.addCtaIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="add" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.addCtaTitle, { color: colors.primary }]}>Add a Bank Card</Text>
            <Text style={[s.addCtaSub, { color: colors.textSecondary }]}>
              See offers that match your cards
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        {/* ── Supported Banks ── */}
        <View style={[s.sectionRow, { marginTop: 28 }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Supported Banks</Text>
          <Text style={[s.sectionCount, { color: colors.textSecondary }]}>
            {SUPPORTED_BANKS.length} banks
          </Text>
        </View>

        <View style={[s.bankList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {SUPPORTED_BANKS.map((bank, i) => {
            const cardCount = BANK_CARDS[bank.id]?.length ?? 0;
            const isLast = i === SUPPORTED_BANKS.length - 1;
            const liveCount = offerCounts[bank.takhfifName] ?? bank.offerCount;
            return (
              <Pressable
                key={bank.id}
                onPress={() =>
                  navigation.navigate('MainTabs', {
                    screen: 'BankOffers',
                    params: { bankFilter: bank.takhfifName },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`View ${bank.name} offers`}
                style={[
                  s.bankRow,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}>
                <View style={[s.bankAvatar, { backgroundColor: bank.color }]}>
                  <Text style={s.bankAvatarTxt}>{bank.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.bankName, { color: colors.text }]}>{bank.name}</Text>
                  {cardCount > 0 && (
                    <Text style={[s.bankSub, { color: colors.textSecondary }]}>
                      {cardCount} cards
                    </Text>
                  )}
                </View>
                <View style={s.bankRight}>
                  <Text style={[s.bankOffers, { color: colors.textSecondary }]}>
                    {liveCount.toLocaleString()} offers
                  </Text>
                  <Icon name="chevron-forward" size={14} color={colors.border} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {showSheet && (
        <AddCardSheet
          onClose={() => setShowSheet(false)}
          onAdd={(bankId, cardType, lastFour, extra) => addCard(bankId, cardType, lastFour, extra)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 2 },

  scroll: { paddingHorizontal: 24, paddingTop: 4 },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.1 },
  sectionCount: { fontSize: 13 },
  countPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20,
  },
  countPillTxt: { fontSize: 12, fontWeight: '800' },

  // ── Empty state ──
  emptyCards: {
    borderRadius: 18, borderWidth: 1, alignItems: 'center',
    paddingVertical: 36, gap: 10, marginBottom: 14,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  // ── Dots ──
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 20, borderRadius: 3 },

  // ── Add CTA ──
  addCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed',
    padding: 16, marginTop: 16,
  },
  addCtaIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  addCtaTitle: { fontSize: 15, fontWeight: '700' },
  addCtaSub: { fontSize: 13, marginTop: 2 },

  // ── Bank list ──
  bankList: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  bankAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bankAvatarTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  bankName: { fontSize: 15, fontWeight: '700' },
  bankSub: { fontSize: 12, marginTop: 2 },
  bankRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bankOffers: { fontSize: 13, fontWeight: '500' },
});
