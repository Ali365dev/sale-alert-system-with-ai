import { useState, useEffect } from 'react';
import {
  Alert,
  Dimensions,
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

const { width: SCREEN_W } = Dimensions.get('window');
// Standard credit card aspect ratio 85.6mm × 53.98mm ≈ 1.586
const CARD_COL_W = (SCREEN_W - 48 - 10) / 2; // 2 cols, 24px side padding each side, 10px gap
const CARD_COL_H = CARD_COL_W / 1.586;

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

// ─── Saved card (shown at top of screen) ─────────────────────────────────────

function PhysicalCard({ card, onRemove }) {
  const bank = getBankById(card.bankId);
  const gradient = CARD_GRADIENTS[card.bankId] || ['#10233F', '#0A1628'];
  const image = card.imageIdx ? CARD_IMAGES[card.imageIdx] : null;

  if (image) {
    return (
      <View style={styles.savedCardWrap}>
        <Image source={image} style={styles.savedCardImage} resizeMode="cover" />
        <Pressable
          onPress={onRemove}
          hitSlop={12}
          style={styles.savedCardRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove card">
          <Icon name="close" size={14} color="#fff" />
        </Pressable>
        {card.lastFour !== '0000' && (
          <View style={styles.savedCardOverlay}>
            <Text style={styles.savedCardName} numberOfLines={1}>
              {card.cardName ?? bank?.name}
            </Text>
            <Text style={styles.savedCardLast}>····{card.lastFour}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.physCard, { backgroundColor: gradient[0] }]}>
      <View style={[styles.physCardShine, { backgroundColor: gradient[1] }]} />
      <View style={styles.physCardTop}>
        <View style={styles.physCardChip} />
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={styles.physCardRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove card">
          <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
      <Text style={styles.physCardNumber}>•••• •••• •••• {card.lastFour}</Text>
      <View style={styles.physCardBottom}>
        <Text style={styles.physCardType}>{card.cardType.toUpperCase()}</Text>
        <Text style={styles.physCardBank}>{bank?.name ?? card.bankId.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ─── Step 1: Bank picker ──────────────────────────────────────────────────────

function BankStep({ onSelect, colors }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}>
      {SUPPORTED_BANKS.map((bank, i) => {
        const cardCount = BANK_CARDS[bank.id]?.length ?? 0;
        const isFirst = i === 0;
        const isLast = i === SUPPORTED_BANKS.length - 1;
        return (
          <Pressable
            key={bank.id}
            onPress={() => onSelect(bank)}
            style={[
              styles.bankPickRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopWidth: isFirst ? 1 : 0,
                borderBottomWidth: 1,
                borderTopLeftRadius: isFirst ? 14 : 0,
                borderTopRightRadius: isFirst ? 14 : 0,
                borderBottomLeftRadius: isLast ? 14 : 0,
                borderBottomRightRadius: isLast ? 14 : 0,
              },
            ]}>
            <View style={[styles.bankCircle, { backgroundColor: bank.color }]}>
              <Text style={styles.bankCircleTxt}>{bank.initials}</Text>
            </View>
            <View style={styles.bankPickText}>
              <Text style={[styles.bankPickName, { color: colors.text }]}>{bank.name}</Text>
              {cardCount > 0 && (
                <Text style={[styles.bankPickSub, { color: colors.textSecondary }]}>
                  {cardCount} cards
                </Text>
              )}
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Step 2: Card grid (2-column, full card images) ──────────────────────────

function CardStep({ bank, onSelect, colors }) {
  const cards = BANK_CARDS[bank.id] ?? [];

  if (cards.length === 0) {
    return (
      <View style={styles.emptyStep}>
        <Icon name="card-outline" size={40} color={colors.textSecondary} />
        <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>
          No cards listed for {bank.name}
        </Text>
      </View>
    );
  }

  // Pair cards into rows of 2
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(cards.slice(i, i + 2));
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.cardGridRow}>
          {row.map((card, ci) => {
            const img = CARD_IMAGES[card.imageIdx];
            const typeBadge = card.type === 'credit' ? 'Credit' : card.type === 'prepaid' ? 'Prepaid' : 'Debit';
            return (
              <Pressable
                key={ci}
                onPress={() => onSelect(card)}
                style={[styles.cardGridItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${card.name}`}>
                {/* Card image */}
                <View style={styles.cardImgContainer}>
                  {img ? (
                    <Image source={img} style={styles.cardImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cardImgPlaceholder, { backgroundColor: colors.background }]}>
                      <Icon name="card" size={32} color={colors.textSecondary} />
                    </View>
                  )}
                  {/* Type badge */}
                  <View style={[
                    styles.cardTypeBadge,
                    card.type === 'credit'
                      ? styles.cardTypeBadgeCredit
                      : card.type === 'prepaid'
                      ? styles.cardTypeBadgePrepaid
                      : styles.cardTypeBadgeDebit,
                  ]}>
                    <Text style={styles.cardTypeBadgeTxt}>{typeBadge}</Text>
                  </View>
                </View>
                {/* Card name */}
                <Text style={[styles.cardGridName, { color: colors.text }]} numberOfLines={2}>
                  {card.name}
                </Text>
                <Text style={[styles.cardGridNetwork, { color: colors.textSecondary }]}>
                  {card.network.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
          {/* Fill empty slot in last row with an invisible spacer */}
          {row.length === 1 && <View style={styles.cardGridSpacer} />}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Step 3: Last 4 digits ────────────────────────────────────────────────────

function LastFourStep({ bank, card, onConfirm, colors }) {
  const [lastFour, setLastFour] = useState('');
  const img = CARD_IMAGES[card.imageIdx];
  const fullW = SCREEN_W - 48;
  const imgH = fullW / 1.586;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}>
      {img && (
        <Image
          source={img}
          style={[styles.lastFourImg, { width: fullW, height: imgH }]}
          resizeMode="cover"
        />
      )}
      <Text style={[styles.lastFourName, { color: colors.text }]} numberOfLines={2}>
        {card.name}
      </Text>
      <Text style={[styles.lastFourBank, { color: colors.textSecondary }]}>{bank.name}</Text>

      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        Last 4 Digits
      </Text>
      <TextInput
        style={[styles.lastFourInput, {
          borderColor: colors.border,
          backgroundColor: colors.background,
          color: colors.text,
        }]}
        placeholder="e.g. 4821  (skip to leave blank)"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        maxLength={4}
        value={lastFour}
        onChangeText={(t) => setLastFour(t.replace(/\D/g, ''))}
      />
      <Pressable
        onPress={() => onConfirm(lastFour || '0000')}
        style={styles.addBtn}
        accessibilityRole="button">
        <Text style={styles.addBtnLabel}>Add Card</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function AddCardModal({ onClose, onAdd }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('bank');
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  const title = step === 'bank'
    ? 'Select Bank'
    : step === 'card'
    ? selectedBank?.name ?? 'Select Card'
    : 'Add Card';

  const goBack = () => {
    if (step === 'card') setStep('bank');
    else if (step === 'lastfour') setStep('card');
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[
        styles.sheet,
        { backgroundColor: colors.surface, paddingBottom: insets.bottom + 8 },
      ]}>
        {/* Handle */}
        <View style={styles.sheetHandle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          {step !== 'bank' ? (
            <Pressable
              onPress={goBack}
              hitSlop={8}
              style={styles.sheetBackBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Icon name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.sheetBackBtn} />
          )}
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={styles.sheetCloseBtn}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Icon name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Content — flex: 1 so each step's ScrollView fills the sheet */}
        <View style={styles.sheetContent}>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MyCardsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const cards = useBankCardsStore((s) => s.cards);
  const addCard = useBankCardsStore((s) => s.addCard);
  const removeCard = useBankCardsStore((s) => s.removeCard);

  const [showAddModal, setShowAddModal] = useState(false);
  // { takhfifName: count } — real counts fetched from backend
  const [offerCounts, setOfferCounts] = useState({});

  useEffect(() => {
    fetchBankOfferCounts()
      .then(setOfferCounts)
      .catch(() => {}); // silent — falls back to static offerCount
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Icon name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Cards</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            Personalize your bank offer feed
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Your Active Cards ({cards.length})
        </Text>

        {cards.length === 0 && (
          <View style={[styles.emptyCards, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="card-outline" size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyCardsTxt, { color: colors.textSecondary }]}>
              No cards added yet
            </Text>
          </View>
        )}

        {cards.map((card) => (
          <PhysicalCard key={card.id} card={card} onRemove={() => handleRemove(card)} />
        ))}

        <Pressable
          onPress={() => setShowAddModal(true)}
          style={[styles.addCta, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.addCtaIcon, { backgroundColor: colors.background }]}>
            <Icon name="add" size={22} color="#F20D38" />
          </View>
          <View style={styles.addCtaText}>
            <Text style={[styles.addCtaTitle, { color: '#F20D38' }]}>Add a Bank Card</Text>
            <Text style={[styles.addCtaSub, { color: colors.textSecondary }]}>
              See offers that match your cards
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 28 }]}>
          Supported Banks
        </Text>

        {SUPPORTED_BANKS.map((bank, i) => {
          const cardCount = BANK_CARDS[bank.id]?.length ?? 0;
          const isFirst = i === 0;
          const isLast = i === SUPPORTED_BANKS.length - 1;
          const liveCount = offerCounts[bank.takhfifName] ?? bank.offerCount;
          return (
            <Pressable
              key={bank.id}
              onPress={() => navigation.navigate('MainTabs', { screen: 'BankOffers', params: { bankFilter: bank.takhfifName } })}
              accessibilityRole="button"
              accessibilityLabel={`View ${bank.name} offers`}
              style={[
                styles.bankRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderTopWidth: isFirst ? 1 : 0,
                  borderBottomWidth: 1,
                  borderTopLeftRadius: isFirst ? 14 : 0,
                  borderTopRightRadius: isFirst ? 14 : 0,
                  borderBottomLeftRadius: isLast ? 14 : 0,
                  borderBottomRightRadius: isLast ? 14 : 0,
                },
              ]}>
              <View style={[styles.bankCircle, { backgroundColor: bank.color }]}>
                <Text style={styles.bankCircleTxt}>{bank.initials}</Text>
              </View>
              <View style={styles.bankRowText}>
                <Text style={[styles.bankRowName, { color: colors.text }]}>{bank.name}</Text>
                <Text style={[styles.bankRowSub, { color: colors.textSecondary }]}>
                  {cardCount > 0 ? `${cardCount} cards` : bank.fullName}
                </Text>
              </View>
              <View style={styles.bankRowRight}>
                <Text style={[styles.bankRowOffers, { color: colors.textSecondary }]}>
                  {liveCount} offers
                </Text>
                <Icon name="chevron-forward" size={14} color={colors.textSecondary} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {showAddModal && (
        <AddCardModal
          onClose={() => setShowAddModal(false)}
          onAdd={(bankId, cardType, lastFour, extra) => addCard(bankId, cardType, lastFour, extra)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },

  // ── Saved card (image variant) ──
  savedCardWrap: {
    borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
    aspectRatio: 1.586,
  },
  savedCardImage: { width: '100%', height: '100%' },
  savedCardRemove: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  savedCardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  savedCardName: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  savedCardLast: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', letterSpacing: 2 },

  // ── Saved card (gradient fallback) ──
  physCard: {
    borderRadius: 18, padding: 20, marginBottom: 14, minHeight: 110,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  physCardShine: {
    position: 'absolute', top: 0, right: 0,
    width: 140, height: 140, borderRadius: 70, opacity: 0.4,
  },
  physCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  physCardChip: { width: 32, height: 24, borderRadius: 4, backgroundColor: '#F5C518' },
  physCardRemove: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  physCardNumber: {
    color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600',
    letterSpacing: 2, marginTop: 16, marginBottom: 10,
  },
  physCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  physCardType: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  physCardBank: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  // ── Add CTA ──
  addCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
    padding: 16, marginBottom: 4,
  },
  addCtaIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addCtaText: { flex: 1 },
  addCtaTitle: { fontSize: 15, fontWeight: '700' },
  addCtaSub: { fontSize: 13, marginTop: 2 },

  // ── Supported banks list ──
  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    borderLeftWidth: 1, borderRightWidth: 1,
  },
  bankCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  bankCircleTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  bankRowText: { flex: 1 },
  bankRowName: { fontSize: 15, fontWeight: '700' },
  bankRowSub: { fontSize: 12, marginTop: 2 },
  bankRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bankRowOffers: { fontSize: 13, fontWeight: '600' },

  // ── Empty state ──
  emptyCards: {
    borderRadius: 14, borderWidth: 1, alignItems: 'center',
    paddingVertical: 28, gap: 10, marginBottom: 14,
  },
  emptyCardsTxt: { fontSize: 14 },

  // ── Bottom sheet ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 0,
    maxHeight: '90%',
    // flex column so sheetContent can flex: 1
    flexDirection: 'column',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
  },
  sheetBackBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sheetCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  // This is the KEY fix — flex: 1 lets ScrollViews fill the sheet
  sheetContent: { flex: 1 },

  // ── Bank step ──
  bankPickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderLeftWidth: 1, borderRightWidth: 1,
  },
  bankPickText: { flex: 1 },
  bankPickName: { fontSize: 15, fontWeight: '700' },
  bankPickSub: { fontSize: 12, marginTop: 2 },

  // ── Card grid (Step 2) ──
  cardGridRow: {
    flexDirection: 'row', gap: 10, marginBottom: 10,
  },
  cardGridItem: {
    width: CARD_COL_W, borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },
  cardImgContainer: {
    width: CARD_COL_W, height: CARD_COL_H,
    backgroundColor: '#1a1a2e',
  },
  cardImg: { width: '100%', height: '100%' },
  cardImgPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTypeBadge: {
    position: 'absolute', top: 6, right: 6,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  cardTypeBadgeDebit:   { backgroundColor: 'rgba(16,185,129,0.85)' },
  cardTypeBadgeCredit:  { backgroundColor: 'rgba(239,68,68,0.85)' },
  cardTypeBadgePrepaid: { backgroundColor: 'rgba(245,158,11,0.85)' },
  cardTypeBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  cardGridName: { fontSize: 11, fontWeight: '700', padding: 8, paddingBottom: 2, lineHeight: 15 },
  cardGridNetwork: { fontSize: 10, paddingHorizontal: 8, paddingBottom: 8 },
  cardGridSpacer: { width: CARD_COL_W },

  // ── Empty step ──
  emptyStep: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTxt: { fontSize: 14 },

  // ── Last four step ──
  lastFourImg: { borderRadius: 14, marginBottom: 16 },
  lastFourName: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  lastFourBank: { fontSize: 13, marginBottom: 24 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  lastFourInput: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 20, fontWeight: '700', letterSpacing: 6,
  },
  addBtn: {
    backgroundColor: '#F20D38', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  addBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
