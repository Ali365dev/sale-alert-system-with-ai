import { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { REGIONS, SUPPORTED_CODES } from '../../config/regions';
import regionStore, { useRegionCode } from '../../state/regionStore';
import { saveRegion } from '../../services/preferencesApi';
import { loadDeals } from '../../services/dealsService';

const SHOWN_CODES = ['PK', 'SA', 'AE', 'QA', 'KW', 'OM', 'BH', 'EG'];
const ALL_COUNTRIES = SHOWN_CODES.filter((c) => REGIONS[c]).map((code) => ({ code, ...REGIONS[code] }));

const PRIMARY = '#E8344E';

function CountryItem({ item, selected, onPress }) {
  return (
    <Pressable
      style={[styles.item, selected && styles.itemSelected]}
      onPress={() => onPress(item.code)}>
      <View style={styles.flagBox}>
        <Text style={styles.flagEmoji}>{item.flag}</Text>
      </View>
      <Text style={[styles.itemName, selected && styles.itemNameSelected]}>{item.name}</Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

export default function SelectCountryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const currentCode = useRegionCode();

  const [selected, setSelected] = useState(currentCode);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_COUNTRIES;
    const q = search.toLowerCase();
    return ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    regionStore.getState().setRegion(selected);
    await saveRegion(selected);
    loadDeals(true); // clearCache — wipe old country's data before fetching new
    setSaving(false);
    navigation.goBack();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle}>Select Country</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>
        Deals, brands and categories will update to match your selected country.
      </Text>

      {/* Search */}
      <View style={styles.searchRow}>
        <Icon name="search-outline" size={18} color="#9AA3B2" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search country..."
          placeholderTextColor="#9AA3B2"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <CountryItem item={item} selected={selected === item.code} onPress={setSelected} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && styles.saveBtnPressed,
            selected === currentCode && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={saving || selected === currentCode}>
          <Text style={styles.saveBtnLabel}>{saving ? 'Saving…' : 'Save Country'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF5',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginHorizontal: 24,
    marginTop: 14,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#F0F2F8',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 16, gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 14,
  },
  itemSelected: { borderColor: PRIMARY, backgroundColor: '#FFF5F7' },
  flagBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECEEF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagEmoji: { fontSize: 26 },
  itemName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  itemNameSelected: { color: PRIMARY },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECEEF5',
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 18,
    height: 56,
  },
  saveBtnPressed: { opacity: 0.88 },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnLabel: { fontSize: 17, fontWeight: '700', color: '#FFF' },
});
