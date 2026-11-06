import { useMemo, useState } from 'react';
import {
  Alert,
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

const CARD_TYPES = [
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
  { id: 'prepaid', label: 'Prepaid' },
];

const CARD_GRADIENTS = {
  hbl: ['#1A6830', '#0D4020'],
  mcb: ['#8B0000', '#5C0000'],
  meezan: ['#1B2F5E', '#0D1A38'],
  ubl: ['#1A237E', '#0D1250'],
  alfalah: ['#7B241C', '#4A1510'],
  scb: ['#0D47A1', '#062470'],
  habibmetro: ['#2E7D32', '#1B4D1E'],
  askari: ['#283593', '#151C5C'],
};

function PhysicalCard({ card, onRemove }) {
  const bank = getBankById(card.bankId);
  const gradient = CARD_GRADIENTS[card.bankId] || ['#10233F', '#0A1628'];

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

      <Text style={styles.physCardNumber}>
        •••• •••• •••• {card.lastFour}
      </Text>

      <View style={styles.physCardBottom}>
        <Text style={styles.physCardType}>{card.cardType.toUpperCase()}</Text>
        <Text style={styles.physCardBank}>{bank?.name ?? card.bankId.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function AddCardModal({ onClose, onAdd }) {
  const { colors } = useTheme();
  const [bankId, setBankId] = useState(null);
  const [cardType, setCardType] = useState('debit');
  const [lastFour, setLastFour] = useState('');

  const canAdd = bankId && lastFour.length === 4;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(bankId, cardType, lastFour);
    onClose();
  };

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
        <View style={styles.modalHandle} />
        <Text style={[styles.modalTitle, { color: colors.text }]}>Add a Bank Card</Text>

        {/* Bank picker */}
        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Select Bank</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPicker}>
          {SUPPORTED_BANKS.map((bank) => {
            const selected = bankId === bank.id;
            return (
              <Pressable
                key={bank.id}
                onPress={() => setBankId(bank.id)}
                style={[
                  styles.bankPickerItem,
                  { borderColor: selected ? bank.color : colors.border, backgroundColor: selected ? bank.color : colors.background },
                ]}>
                <Text style={[styles.bankPickerInitials, { color: selected ? '#FFF' : colors.text }]}>
                  {bank.initials}
                </Text>
                <Text style={[styles.bankPickerName, { color: selected ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>
                  {bank.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Card type */}
        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Card Type</Text>
        <View style={styles.cardTypeRow}>
          {CARD_TYPES.map((ct) => {
            const selected = cardType === ct.id;
            return (
              <Pressable
                key={ct.id}
                onPress={() => setCardType(ct.id)}
                style={[
                  styles.cardTypeBtn,
                  {
                    backgroundColor: selected ? '#F20D38' : colors.background,
                    borderColor: selected ? '#F20D38' : colors.border,
                  },
                ]}>
                <Text style={[styles.cardTypeBtnLabel, { color: selected ? '#FFF' : colors.text }]}>
                  {ct.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Last 4 digits */}
        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Last 4 Digits</Text>
        <TextInput
          style={[styles.lastFourInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
          placeholder="e.g. 4821"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          maxLength={4}
          value={lastFour}
          onChangeText={(t) => setLastFour(t.replace(/\D/g, ''))}
        />

        <Pressable
          onPress={handleAdd}
          disabled={!canAdd}
          style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}>
          <Text style={styles.addBtnLabel}>Add Card</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MyCardsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const cards = useBankCardsStore((s) => s.cards);
  const addCard = useBankCardsStore((s) => s.addCard);
  const removeCard = useBankCardsStore((s) => s.removeCard);

  const [showAddModal, setShowAddModal] = useState(false);

  const handleRemove = (card) => {
    const bank = getBankById(card.bankId);
    Alert.alert(
      'Remove Card',
      `Remove ${bank?.name ?? card.bankId} ····${card.lastFour}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeCard(card.id) },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
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

        {/* Active cards section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Your Active Cards ({cards.length})
        </Text>

        {cards.map((card) => (
          <PhysicalCard key={card.id} card={card} onRemove={() => handleRemove(card)} />
        ))}

        {/* Add card CTA */}
        <Pressable
          onPress={() => setShowAddModal(true)}
          style={[styles.addCardCta, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.addCardIcon, { backgroundColor: colors.background }]}>
            <Icon name="add" size={22} color="#F20D38" />
          </View>
          <View style={styles.addCardText}>
            <Text style={[styles.addCardTitle, { color: '#F20D38' }]}>Add a Bank Card</Text>
            <Text style={[styles.addCardSub, { color: colors.textSecondary }]}>
              See offers that match your cards
            </Text>
          </View>
        </Pressable>

        {/* Supported banks */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 28 }]}>
          Supported Banks
        </Text>

        {SUPPORTED_BANKS.map((bank, i) => (
          <View
            key={bank.id}
            style={[
              styles.bankRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopLeftRadius: i === 0 ? 14 : 0,
                borderTopRightRadius: i === 0 ? 14 : 0,
                borderBottomLeftRadius: i === SUPPORTED_BANKS.length - 1 ? 14 : 0,
                borderBottomRightRadius: i === SUPPORTED_BANKS.length - 1 ? 14 : 0,
                borderTopWidth: i === 0 ? 1 : 0,
                borderBottomWidth: 1,
              },
            ]}>
            <View style={[styles.bankInitialsCircle, { backgroundColor: bank.color }]}>
              <Text style={styles.bankInitialsText}>{bank.initials}</Text>
            </View>
            <View style={styles.bankRowText}>
              <Text style={[styles.bankRowName, { color: colors.text }]}>{bank.name}</Text>
              <Text style={[styles.bankRowFull, { color: colors.textSecondary }]}>{bank.fullName}</Text>
            </View>
            <Text style={[styles.bankRowCount, { color: colors.textSecondary }]}>
              {bank.offerCount} offers
            </Text>
          </View>
        ))}
      </ScrollView>

      {showAddModal && (
        <AddCardModal
          onClose={() => setShowAddModal(false)}
          onAdd={(bankId, cardType, lastFour) => addCard(bankId, cardType, lastFour)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  physCard: {
    borderRadius: 18, padding: 20,
    marginBottom: 14, minHeight: 110,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  physCardShine: {
    position: 'absolute', top: 0, right: 0,
    width: 140, height: 140, borderRadius: 70,
    opacity: 0.4,
  },
  physCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  physCardChip: {
    width: 32, height: 24, borderRadius: 4, backgroundColor: '#F5C518',
  },
  physCardRemove: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  physCardNumber: {
    color: 'rgba(255,255,255,0.8)', fontSize: 15,
    fontWeight: '600', letterSpacing: 2,
    marginTop: 16, marginBottom: 10,
  },
  physCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  physCardType: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  physCardBank: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  addCardCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
    padding: 16, marginBottom: 4,
  },
  addCardIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  addCardText: { flex: 1 },
  addCardTitle: { fontSize: 15, fontWeight: '700' },
  addCardSub: { fontSize: 13, marginTop: 2 },
  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    borderLeftWidth: 1, borderRightWidth: 1,
  },
  bankInitialsCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  bankInitialsText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  bankRowText: { flex: 1 },
  bankRowName: { fontSize: 15, fontWeight: '700' },
  bankRowFull: { fontSize: 12, marginTop: 2 },
  bankRowCount: { fontSize: 13, fontWeight: '600' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 16 },
  bankPicker: { gap: 10, paddingBottom: 4 },
  bankPickerItem: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, minWidth: 72, gap: 4,
  },
  bankPickerInitials: { fontSize: 16, fontWeight: '900' },
  bankPickerName: { fontSize: 11, fontWeight: '600' },
  cardTypeRow: { flexDirection: 'row', gap: 10 },
  cardTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5,
  },
  cardTypeBtnLabel: { fontSize: 14, fontWeight: '700' },
  lastFourInput: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 18, fontWeight: '700', letterSpacing: 4,
  },
  addBtn: {
    backgroundColor: '#F20D38', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnLabel: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
